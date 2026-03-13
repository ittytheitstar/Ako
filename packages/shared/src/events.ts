export type DomainEventType =
  | 'post.created'
  | 'post.updated'
  | 'post.deleted'
  | 'reaction.added'
  | 'reaction.removed'
  | 'assignment.submitted'
  | 'assignment.graded'
  | 'grade.updated'
  | 'message.created'
  | 'typing.started'
  | 'course.updated'
  | 'enrolment.created'
  | 'announcement.published'
  | 'presence.updated'
  | 'thread.created'
  | 'thread.locked';

export interface DomainEvent<T = unknown> {
  eventId: string;
  type: DomainEventType;
  tenantId: string;
  channel: string;
  data: T;
  timestamp: string;
}

export interface ChannelMessage {
  type: 'event' | 'typing' | 'subscribed' | 'error';
  channel?: string;
  event?: DomainEventType;
  data?: unknown;
  userId?: string;
}

export interface ClientMessage {
  type: 'subscribe' | 'unsubscribe' | 'typing' | 'presence';
  channel: string;
  status?: 'online' | 'idle' | 'offline';
}
