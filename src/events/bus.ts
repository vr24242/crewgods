// ═══════════════════════════════════════════════════════
// EVENT BUS — Ingests, normalizes, and routes events
// to Temporal workflows
// ═══════════════════════════════════════════════════════

import { Client } from "@temporalio/client";
import type { CrewgodsEvent, EventSubscription, EventFilter } from "./types";
import { v4 as uuid } from "uuid";

export class EventBus {
  private subscriptions: Map<string, EventSubscription[]> = new Map();
  private temporalClient: Client;

  constructor(temporalClient: Client) {
    this.temporalClient = temporalClient;
  }

  // ── Emit an event ─────────────────────────────────────

  async emit<T>(
    type: string,
    source: string,
    orgId: string,
    payload: T,
    metadata?: Partial<CrewgodsEvent["metadata"]>,
  ): Promise<CrewgodsEvent<T>> {
    const event: CrewgodsEvent<T> = {
      id: uuid(),
      type,
      source,
      orgId,
      timestamp: new Date().toISOString(),
      payload,
      metadata: {
        correlationId: metadata?.correlationId ?? uuid(),
        ...metadata,
      },
    };

    console.log(`[EventBus] ${event.type} from ${event.source} (org: ${event.orgId})`);

    // Route to matching subscriptions
    await this.route(event);

    return event;
  }

  // ── Normalize raw webhook payloads into events ────────

  normalizeWebhook(
    source: string,
    rawEvent: string,
    rawPayload: unknown,
    orgId: string,
  ): CrewgodsEvent {
    return {
      id: uuid(),
      type: this.mapExternalEvent(source, rawEvent),
      source,
      orgId,
      timestamp: new Date().toISOString(),
      payload: this.normalizePayload(source, rawPayload),
      metadata: { raw: rawPayload, sourceEventId: rawEvent },
    };
  }

  private mapExternalEvent(source: string, rawEvent: string): string {
    const mapping: Record<string, Record<string, string>> = {
      shopify: {
        "orders/create": "order.created",
        "orders/updated": "order.updated",
        "orders/fulfilled": "order.fulfilled",
        "products/update": "inventory.updated",
      },
      zendesk: {
        "ticket.created": "ticket.created",
        "ticket.updated": "ticket.updated",
      },
      github: {
        "issues.opened": "ticket.created",
        "pull_request.opened": "pr.opened",
        "release.created": "release.created",
      },
      stripe: {
        "payment_intent.succeeded": "payment.received",
        "payment_intent.payment_failed": "payment.failed",
        "invoice.created": "invoice.received",
      },
      gmail: {
        "messages.received": "email.received",
      },
      slack: {
        "message": "slack.message",
        "message.im": "slack.message",
      },
      hubspot: {
        "contact.creation": "lead.created",
        "deal.propertyChange": "deal.updated",
      },
      greenhouse: {
        "candidate.application_created": "application.received",
        "candidate.hired": "candidate.hired",
      },
      pagerduty: {
        "incident.triggered": "incident.triggered",
      },
      docusign: {
        "envelope.sent": "contract.received",
        "envelope.completed": "contract.signed",
      },
    };

    return mapping[source]?.[rawEvent] ?? `${source}.${rawEvent}`;
  }

  private normalizePayload(source: string, raw: unknown): unknown {
    // In production, each integration would have a normalizer
    // that maps source-specific fields to a common schema
    return raw;
  }

  // ── Subscribe a workflow to an event ──────────────────

  subscribe(subscription: EventSubscription): void {
    const types = Array.isArray(subscription.eventType)
      ? subscription.eventType
      : [subscription.eventType];

    for (const type of types) {
      const existing = this.subscriptions.get(type) ?? [];
      existing.push(subscription);
      this.subscriptions.set(type, existing);
    }
  }

  unsubscribe(subscriptionId: string): void {
    for (const [type, subs] of this.subscriptions) {
      this.subscriptions.set(type, subs.filter((s) => s.id !== subscriptionId));
    }
  }

  // ── Route event to matching workflows ─────────────────

  private async route(event: CrewgodsEvent): Promise<void> {
    const subs = this.subscriptions.get(event.type) ?? [];
    const wildcardSubs = this.subscriptions.get("*") ?? [];
    const allSubs = [...subs, ...wildcardSubs].filter(
      (s) => s.active && s.orgId === event.orgId,
    );

    for (const sub of allSubs) {
      if (sub.filter && !this.matchesFilter(event.payload, sub.filter)) {
        continue;
      }

      try {
        await this.temporalClient.workflow.start(sub.workflowId, {
          taskQueue: "crewgods-main",
          workflowId: `${sub.workflowId}-${event.id}`,
          args: [event],
        });
        console.log(`[EventBus] Dispatched ${event.type} → ${sub.workflowId}`);
      } catch (err) {
        console.error(`[EventBus] Failed to dispatch ${event.type} → ${sub.workflowId}:`, err);
      }
    }
  }

  private matchesFilter(payload: unknown, filter: EventFilter): boolean {
    const value = getNestedValue(payload, filter.field);
    switch (filter.operator) {
      case "eq": return value === filter.value;
      case "neq": return value !== filter.value;
      case "gt": return (value as number) > (filter.value as number);
      case "lt": return (value as number) < (filter.value as number);
      case "contains": return typeof value === "string" && value.includes(filter.value as string);
      case "exists": return value !== undefined && value !== null;
      case "matches": return typeof value === "string" && new RegExp(filter.value as string).test(value);
      default: return true;
    }
  }
}

function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj) return undefined;
  return path.split(".").reduce((curr: any, key) => curr?.[key], obj);
}
