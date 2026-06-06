type AppMessageType = 'error';

/**
 * Base structure for all app messages
 */
interface BaseAppMessage<T> {
  /** The type of the message */
  type: AppMessageType;
  /** Identifier for what sent this message */
  source: string;
  /** The payload of the message */
  payload: T;
}

/**
 * Error payload for postMessage.
 * Error has non-enumerable properties which cannot be directly serialized,
 * so we define a serializable structure here.
 */
interface ErrorPayload {
  name: string;
  message: string;
  stack?: string;
  componentStack?: string | null;
}

/**
 * Error message type
 */
export interface ErrorMessage extends BaseAppMessage<ErrorPayload> {
  type: 'error';
  payload: ErrorPayload;
}

/**
 * Union of all possible app messages
 */
export type AppMessage = ErrorMessage;