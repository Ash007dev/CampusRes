"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import {
  Settings,
  Loader2,
  Save,
  Clock,
  RefreshCw,
  X,
  AlertCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { configApi, type SystemConfig, type ConfigCategory } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface SystemConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<ConfigCategory, string> = {
  general: "General",
  booking: "Booking",
  notification: "Notification",
  security: "Security",
};

const CATEGORY_COLORS: Record<ConfigCategory, string> = {
  general: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
  booking: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  notification: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  security: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export function SystemConfigModal({ isOpen, onClose }: SystemConfigModalProps) {
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [selectedCategory, setSelectedCategory] = useState<ConfigCategory | "all">("all");
  const { toast } = useToast();

  const fetchConfigs = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await configApi.getAll(
        selectedCategory !== "all" ? { category: selectedCategory } : undefined
      );
      setConfigs(response.data.data || []);
      
      // Initialize edited values
      const values: Record<string, string> = {};
      (response.data.data || []).forEach((config: SystemConfig) => {
        values[config.key] = config.value;
      });
      setEditedValues(values);
    } catch (error) {
      console.error("Failed to fetch config:", error);
      toast({
        title: "Error",
        description: "Failed to load configuration",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, toast]);

  useEffect(() => {
    if (isOpen) {
      fetchConfigs();
    }
  }, [isOpen, fetchConfigs]);

  const handleValueChange = (key: string, value: string) => {
    setEditedValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (key: string) => {
    const config = configs.find(c => c.key === key);
    if (!config) return;

    const newValue = editedValues[key];
    if (newValue === config.value) return; // No change

    setIsSaving(true);
    try {
      await configApi.update(key, { value: newValue });
      toast({
        title: "Configuration Updated",
        description: `${config.key} has been updated`,
      });
      fetchConfigs(); // Refresh to get updated data
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update configuration",
        variant: "destructive",
      });
      // Revert value on error
      setEditedValues(prev => ({ ...prev, [key]: config.value }));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    let successCount = 0;
    let errorCount = 0;

    for (const config of configs) {
      const newValue = editedValues[config.key];
      if (newValue !== config.value) {
        try {
          await configApi.update(config.key, { value: newValue });
          successCount++;
        } catch (error) {
          errorCount++;
          // Revert value on error
          setEditedValues(prev => ({ ...prev, [config.key]: config.value }));
        }
      }
    }

    setIsSaving(false);

    if (successCount > 0) {
      toast({
        title: "Configuration Updated",
        description: `${successCount} setting(s) updated successfully${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
      });
      fetchConfigs();
    } else if (errorCount > 0) {
      toast({
        title: "Error",
        description: "Failed to update configuration",
        variant: "destructive",
      });
    } else {
      toast({
        title: "No Changes",
        description: "No configuration values were modified",
      });
    }
  };

  const renderInput = (config: SystemConfig) => {
    const value = editedValues[config.key] ?? config.value;
    const hasChanged = value !== config.value;

    switch (config.dataType) {
      case 'boolean':
        return (
          <div className="flex items-center gap-4">
            <select
              value={value}
              onChange={(e) => handleValueChange(config.key, e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="true">True</option>
              <option value="false">False</option>
            </select>
            {hasChanged && (
              <Button
                size="sm"
                onClick={() => handleSave(config.key)}
                disabled={isSaving}
              >
                <Save className="h-4 w-4" />
              </Button>
            )}
          </div>
        );

      case 'number':
        return (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={value}
              onChange={(e) => handleValueChange(config.key, e.target.value)}
              className="flex-1"
            />
            {hasChanged && (
              <Button
                size="sm"
                onClick={() => handleSave(config.key)}
                disabled={isSaving}
              >
                <Save className="h-4 w-4" />
              </Button>
            )}
          </div>
        );

      case 'time':
        return (
          <div className="flex items-center gap-2">
            <Input
              type="time"
              value={value}
              onChange={(e) => handleValueChange(config.key, e.target.value)}
              className="flex-1"
            />
            {hasChanged && (
              <Button
                size="sm"
                onClick={() => handleSave(config.key)}
                disabled={isSaving}
              >
                <Save className="h-4 w-4" />
              </Button>
            )}
          </div>
        );

      case 'string':
      default:
        return (
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={value}
              onChange={(e) => handleValueChange(config.key, e.target.value)}
              className="flex-1"
            />
            {hasChanged && (
              <Button
                size="sm"
                onClick={() => handleSave(config.key)}
                disabled={isSaving}
              >
                <Save className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
    }
  };

  const hasAnyChanges = configs.some(config => editedValues[config.key] !== config.value);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            System Configuration
          </DialogTitle>
          <DialogDescription>
            Manage global system settings and booking parameters
          </DialogDescription>
        </DialogHeader>

        {/* Category Filter */}
        <div className="flex items-center gap-2 py-2">
          <Button
            variant={selectedCategory === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory("all")}
          >
            All
          </Button>
          {(Object.keys(CATEGORY_LABELS) as ConfigCategory[]).map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
            >
              {CATEGORY_LABELS[cat]}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchConfigs}
            disabled={isLoading}
            className="ml-auto"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>

        <Separator />

        {/* Config List */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : configs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No configuration found</p>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {configs.map((config) => (
                <div
                  key={config.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                          {config.key}
                        </code>
                        <Badge className={cn("text-xs", CATEGORY_COLORS[config.category])}>
                          {CATEGORY_LABELS[config.category]}
                        </Badge>
                        {config.isPublic && (
                          <Badge variant="outline" className="text-xs">
                            Public
                          </Badge>
                        )}
                        {config.dataType === 'time' && (
                          <Clock className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                      {config.description && (
                        <p className="text-sm text-muted-foreground">
                          {config.description}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Value</Label>
                    {renderInput(config)}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Last updated: {new Date(config.updatedAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {hasAnyChanges && (
              <>
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <span>Unsaved changes</span>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {hasAnyChanges && (
              <Button onClick={handleSaveAll} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save All Changes
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
