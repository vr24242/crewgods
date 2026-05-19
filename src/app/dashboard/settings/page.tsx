"use client";

import { useState } from "react";
import {
  Building2,
  DollarSign,
  Bell,
  Shield,
  Globe,
  Save,
} from "lucide-react";
import { cn, formatCents } from "@/lib/utils";

// TODO: Wire to settings API when available.
// Currently using local state — settings persistence is not yet in the API.

export default function SettingsPage() {
  const [orgName, setOrgName] = useState("Demo Company");
  const [budget, setBudget] = useState(5000);
  const [notifications, setNotifications] = useState({
    slackAlerts: true,
    emailDigest: true,
    approvalReminders: true,
    weeklyReport: true,
    failureAlerts: true,
  });

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">Settings</h1>
        <p className="text-sm text-ink-muted mt-1">Configure your organization and preferences</p>
      </div>

      {/* Organization */}
      <Section icon={<Building2 className="w-4 h-4" />} title="Organization">
        <div className="space-y-4">
          <Field label="Organization Name">
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-full px-3 py-2 bg-cream-200 border border-ink/12 rounded-2xl text-sm text-ink focus:outline-none focus:border-ink/20"
            />
          </Field>
          <Field label="Org ID">
            <div className="text-sm text-ink-muted font-mono bg-cream-200 px-3 py-2 rounded-2xl">
              org_a1b2c3d4e5f6
            </div>
          </Field>
          <Field label="Plan">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium px-3 py-1 rounded-full bg-ink/5 text-ink">Growth</span>
              <span className="text-xs text-ink-muted">5 packs, 5K runs/mo</span>
            </div>
          </Field>
        </div>
      </Section>

      {/* Budget */}
      <Section icon={<DollarSign className="w-4 h-4" />} title="Budget & Limits">
        <div className="space-y-4">
          <Field label="Monthly Budget">
            <div className="flex items-center gap-3">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">$</span>
                <input
                  type="number"
                  value={(budget / 100).toFixed(0)}
                  onChange={(e) => setBudget(parseInt(e.target.value) * 100)}
                  className="w-32 pl-7 pr-3 py-2 bg-cream-200 border border-ink/12 rounded-2xl text-sm text-ink focus:outline-none focus:border-ink/20"
                />
              </div>
              <span className="text-xs text-ink-muted">per month</span>
            </div>
          </Field>
          <Field label="Current Spend">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-muted">{formatCents(1285)} of {formatCents(budget)} used</span>
                <span className="text-ink-muted">25.7%</span>
              </div>
              <div className="w-full h-2 bg-cream-200 rounded-full overflow-hidden">
                <div className="h-full bg-ink rounded-full" style={{ width: "25.7%" }} />
              </div>
            </div>
          </Field>
          <Field label="Alert Threshold">
            <div className="flex items-center gap-2">
              <select className="px-3 py-2 bg-cream-200 border border-ink/12 rounded-2xl text-sm text-ink focus:outline-none">
                <option>80%</option>
                <option>90%</option>
                <option>95%</option>
              </select>
              <span className="text-xs text-ink-muted">Alert when budget reaches this percentage</span>
            </div>
          </Field>
        </div>
      </Section>

      {/* Notifications */}
      <Section icon={<Bell className="w-4 h-4" />} title="Notifications">
        <div className="space-y-3">
          {Object.entries(notifications).map(([key, value]) => (
            <label key={key} className="flex items-center justify-between py-2 cursor-pointer">
              <div>
                <div className="text-sm font-medium text-ink capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</div>
                <div className="text-xs text-ink-muted">
                  {key === "slackAlerts" && "Real-time alerts for failures and escalations"}
                  {key === "emailDigest" && "Daily email summary of all workflow activity"}
                  {key === "approvalReminders" && "Reminder after 4 hours if approval pending"}
                  {key === "weeklyReport" && "Weekly performance and cost report"}
                  {key === "failureAlerts" && "Immediate notification on workflow failure"}
                </div>
              </div>
              <button
                onClick={() => setNotifications({ ...notifications, [key]: !value })}
                className={cn(
                  "w-10 h-6 rounded-full transition-colors relative",
                  value ? "bg-ink" : "bg-ink/20"
                )}
              >
                <div className={cn(
                  "w-4 h-4 rounded-full bg-white absolute top-1 transition-transform",
                  value ? "translate-x-5" : "translate-x-1"
                )} />
              </button>
            </label>
          ))}
        </div>
      </Section>

      {/* Webhook Config */}
      <Section icon={<Globe className="w-4 h-4" />} title="Webhook URLs">
        <div className="space-y-4">
          <Field label="Your webhook base URL">
            <div className="text-sm text-ink-soft font-mono bg-cream-200 px-3 py-2 rounded-2xl break-all">
              https://api.crewgods.com/webhooks/[provider]/org_a1b2c3d4e5f6
            </div>
          </Field>
          <div className="text-xs text-ink-muted">
            Configure this URL in your integration settings. Replace [provider] with: slack, shopify, zendesk, github, stripe, etc.
          </div>
        </div>
      </Section>

      {/* Save */}
      <div className="flex justify-end pt-4 border-t border-ink/8">
        <button className="flex items-center gap-2 px-6 py-2.5 bg-ink text-cream font-medium rounded-2xl hover:bg-ink-soft transition-colors text-sm">
          <Save className="w-4 h-4" /> Save Changes
        </button>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/40 border border-ink/8 rounded-2xl p-5">
      <h2 className="font-semibold flex items-center gap-2 mb-4 text-ink-soft">{icon}{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-ink-muted font-medium block mb-1.5">{label}</label>
      {children}
    </div>
  );
}
