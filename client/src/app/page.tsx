'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  Calendar,
  Building2,
  Users,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  Clock,
  Shield
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-8 w-8 text-primary" />
            <span className="font-bold text-xl">Campus Resource Engine</span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link href="/auth/login">
              <Button variant="ghost">Login</Button>
            </Link>
            <Link href="/auth/register">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight mb-6">
          Intelligent Campus Resource
          <span className="text-primary block mt-2">Reservation System</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Book rooms, labs, and auditoriums with ease. Smart scheduling,
          real-time availability, and fair access for everyone.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/auth/register">
            <Button size="lg" className="gap-2">
              Start Booking <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button size="lg" variant="outline">
              Browse Rooms
            </Button>
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">
          Why Choose Campus Resource Engine?
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeatureCard
            icon={<Calendar className="h-8 w-8" />}
            title="Smart Scheduling"
            description="Visual calendar with real-time availability. Book recurring slots up to 10 weeks ahead."
          />
          <FeatureCard
            icon={<Clock className="h-8 w-8" />}
            title="Ghost Killer"
            description="Automated no-show detection. Rooms are released within 15 minutes if not checked in."
          />
          <FeatureCard
            icon={<Shield className="h-8 w-8" />}
            title="Fair Access"
            description="Weekly quotas and reputation system ensure fair distribution of resources."
          />
          <FeatureCard
            icon={<BarChart3 className="h-8 w-8" />}
            title="Analytics"
            description="Department usage insights, demand forecasting, and smart suggestions."
          />
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-4 py-16 bg-muted rounded-3xl">
        <h2 className="text-3xl font-bold text-center mb-12">
          How It Works
        </h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <StepCard
            step={1}
            title="Find a Room"
            description="Search by capacity, amenities, or location. Filter by projector, AC, video conferencing."
          />
          <StepCard
            step={2}
            title="Book Your Slot"
            description="Select your time, add details, and confirm. Get instant confirmation or admin approval."
          />
          <StepCard
            step={3}
            title="Check In"
            description="Scan the QR code at the room to confirm your presence. No-shows affect your reputation."
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-24 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
        <p className="text-muted-foreground mb-8">
          Join thousands of students and faculty using Campus Resource Engine.
        </p>
        <Link href="/auth/register">
          <Button size="lg" className="gap-2">
            Create Your Account <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2026 Campus Resource Engine. Built with ❤️ for better campus experience.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-card rounded-xl p-6 shadow-sm border hover:shadow-md transition-shadow">
      <div className="text-primary mb-4">{icon}</div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}

function StepCard({
  step,
  title,
  description
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-4">
        {step}
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}
