"use client";

import React, { useState, useCallback } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle2, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { bookingsApi } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

interface TimetableEntry {
  roomCode: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  title: string;
  description?: string;
  weeks: number;
}

interface ParsedEntry extends TimetableEntry {
  rowNumber: number;
  isValid: boolean;
  errors: string[];
}

interface BulkImportTimetableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// CSV Template for download
const CSV_TEMPLATE = `roomCode,dayOfWeek,startTime,endTime,title,description,weeks
LAB-001,1,09:00,11:00,Data Structures Lab,Computer Science Lab Session,12
LH-101,2,14:00,16:00,Database Systems,Database Management Lecture,12
SR-201,3,10:00,12:00,Team Meeting,Weekly Project Sync,8`;

export function BulkImportTimetableModal({ isOpen, onClose, onSuccess }: BulkImportTimetableModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; errors: any[] } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const validateEntry = (entry: any, rowNumber: number): ParsedEntry => {
    const errors: string[] = [];

    if (!entry.roomCode || typeof entry.roomCode !== 'string') {
      errors.push('Missing or invalid roomCode');
    }

    const dayOfWeek = parseInt(entry.dayOfWeek);
    if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      errors.push('dayOfWeek must be 0-6 (0=Sunday)');
    }

    if (!entry.startTime || !/^\d{2}:\d{2}$/.test(entry.startTime)) {
      errors.push('startTime must be in HH:mm format');
    }

    if (!entry.endTime || !/^\d{2}:\d{2}$/.test(entry.endTime)) {
      errors.push('endTime must be in HH:mm format');
    }

    if (!entry.title || typeof entry.title !== 'string') {
      errors.push('Missing or invalid title');
    }

    const weeks = parseInt(entry.weeks);
    if (isNaN(weeks) || weeks < 1 || weeks > 52) {
      errors.push('weeks must be between 1 and 52');
    }

    return {
      roomCode: entry.roomCode || '',
      dayOfWeek: dayOfWeek || 0,
      startTime: entry.startTime || '',
      endTime: entry.endTime || '',
      title: entry.title || '',
      description: entry.description || '',
      weeks: weeks || 0,
      rowNumber,
      isValid: errors.length === 0,
      errors,
    };
  };

  const parseCSV = useCallback((text: string) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) {
      toast({
        title: 'Invalid CSV',
        description: 'CSV file must contain a header row and at least one data row',
        variant: 'destructive',
      });
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const requiredHeaders = ['roomCode', 'dayOfWeek', 'startTime', 'endTime', 'title', 'weeks'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

    if (missingHeaders.length > 0) {
      toast({
        title: 'Invalid CSV Format',
        description: `Missing required columns: ${missingHeaders.join(', ')}`,
        variant: 'destructive',
      });
      return;
    }

    const parsed: ParsedEntry[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(',').map(v => v.trim());
      const entry: any = {};
      headers.forEach((header, index) => {
        entry[header] = values[index] || '';
      });

      parsed.push(validateEntry(entry, i + 1));
    }

    setParsedData(parsed);
    setIsProcessing(false);
  }, [toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast({
        title: 'Invalid File Type',
        description: 'Please upload a CSV file',
        variant: 'destructive',
      });
      return;
    }

    setFile(selectedFile);
    setIsProcessing(true);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (!droppedFile) return;

    if (!droppedFile.name.endsWith('.csv')) {
      toast({
        title: 'Invalid File Type',
        description: 'Please upload a CSV file',
        variant: 'destructive',
      });
      return;
    }

    setFile(droppedFile);
    setIsProcessing(true);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(droppedFile);
  };

  const handleImport = async () => {
    const validEntries = parsedData.filter(e => e.isValid);
    if (validEntries.length === 0) {
      toast({
        title: 'No Valid Entries',
        description: 'Please fix validation errors before importing',
        variant: 'destructive',
      });
      return;
    }

    setIsImporting(true);
    try {
      const entries = validEntries.map(e => ({
        roomCode: e.roomCode,
        dayOfWeek: e.dayOfWeek,
        startTime: e.startTime,
        endTime: e.endTime,
        title: e.title,
        description: e.description,
        weeks: e.weeks,
      }));

      const response = await bookingsApi.importTimetable(entries);
      const result = response.data.data;

      setImportResult(result);
      toast({
        title: 'Import Complete',
        description: `Successfully created ${result.created} bookings`,
      });

      if (result.created > 0) {
        onSuccess();
      }
    } catch (error: any) {
      toast({
        title: 'Import Failed',
        description: error?.response?.data?.error?.message || 'Failed to import timetable',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'timetable-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    setFile(null);
    setParsedData([]);
    setImportResult(null);
    onClose();
  };

  const validCount = parsedData.filter(e => e.isValid).length;
  const invalidCount = parsedData.length - validCount;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold mb-1">
                Bulk Import Timetable
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Upload a CSV file to create recurring class bookings for the semester
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-8 w-8 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Template Download */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="font-medium text-sm mb-1">Need a template?</p>
                <p className="text-sm text-muted-foreground">
                  Download our CSV template with example data and required column format
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                className="rounded-lg shrink-0"
              >
                <Download className="mr-2 h-3 w-3" />
                Template
              </Button>
            </div>
          </div>

          {/* File Upload Area */}
          {!file && (
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-neutral-300 dark:border-neutral-700 hover:border-primary/50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold mb-2">Drop CSV file here</h3>
              <p className="text-sm text-muted-foreground mb-4">
                or click to browse
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload">
                <Button variant="outline" className="rounded-lg" asChild>
                  <span>Choose File</span>
                </Button>
              </label>
            </div>
          )}

          {/* File Info & Preview */}
          {file && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                <FileText className="h-8 w-8 text-primary" />
                <div className="flex-1">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFile(null);
                    setParsedData([]);
                    setImportResult(null);
                  }}
                >
                  Remove
                </Button>
              </div>

              {/* Statistics */}
              {parsedData.length > 0 && (
                <div className="flex gap-3">
                  <div className="flex-1 p-4 rounded-lg border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="font-semibold text-green-600 dark:text-green-400">Valid</span>
                    </div>
                    <p className="text-2xl font-bold">{validCount}</p>
                  </div>
                  {invalidCount > 0 && (
                    <div className="flex-1 p-4 rounded-lg border bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                        <span className="font-semibold text-red-600 dark:text-red-400">Invalid</span>
                      </div>
                      <p className="text-2xl font-bold">{invalidCount}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Preview Table */}
              {parsedData.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Row</th>
                          <th className="px-3 py-2 text-left font-medium">Room</th>
                          <th className="px-3 py-2 text-left font-medium">Day</th>
                          <th className="px-3 py-2 text-left font-medium">Time</th>
                          <th className="px-3 py-2 text-left font-medium">Title</th>
                          <th className="px-3 py-2 text-left font-medium">Weeks</th>
                          <th className="px-3 py-2 text-left font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedData.map((entry) => (
                          <tr
                            key={entry.rowNumber}
                            className={`border-t ${
                              !entry.isValid ? 'bg-red-50 dark:bg-red-950/10' : ''
                            }`}
                          >
                            <td className="px-3 py-2">{entry.rowNumber}</td>
                            <td className="px-3 py-2 font-mono text-xs">{entry.roomCode}</td>
                            <td className="px-3 py-2">{DAY_NAMES[entry.dayOfWeek]}</td>
                            <td className="px-3 py-2 font-mono text-xs">
                              {entry.startTime}-{entry.endTime}
                            </td>
                            <td className="px-3 py-2">{entry.title}</td>
                            <td className="px-3 py-2">{entry.weeks}</td>
                            <td className="px-3 py-2">
                              {entry.isValid ? (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                  Valid
                                </Badge>
                              ) : (
                                <div className="space-y-1">
                                  <Badge variant="destructive">Invalid</Badge>
                                  {entry.errors.map((err, i) => (
                                    <p key={i} className="text-xs text-red-600">{err}</p>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Import Result */}
              {importResult && (
                <div className="p-4 rounded-lg border bg-card">
                  <h3 className="font-semibold mb-2">Import Results</h3>
                  <p className="text-sm">
                    Successfully created <span className="font-bold text-green-600">{importResult.created}</span> bookings
                  </p>
                  {importResult.errors.length > 0 && (
                    <div className="mt-2 text-sm text-red-600">
                      <p className="font-medium">{importResult.errors.length} errors occurred</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isImporting}
              className="rounded-xl"
            >
              {importResult ? 'Close' : 'Cancel'}
            </Button>
            {parsedData.length > 0 && !importResult && (
              <Button
                onClick={handleImport}
                disabled={isImporting || validCount === 0}
                className="rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-300"
              >
                {isImporting ? 'Importing...' : `Import ${validCount} Entries`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
