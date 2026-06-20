import { z } from "zod";
import type { DeleteMode, OperationParameters, OperationType } from "./operation-types.js";
import { operationTypes } from "./operation-types.js";

const deployParametersSchema = z.object({
  rebuild: z.boolean().optional()
}).strict();

const rebuildParametersSchema = z.object({
  keepData: z.boolean().optional()
}).strict();

const revisionParametersSchema = z.object({
  targetRevision: z.string().min(1).max(200)
}).strict();

const deleteParametersSchema = z.object({
  mode: z.enum(["configOnly", "sourceAndConfig", "full"] satisfies [DeleteMode, DeleteMode, DeleteMode])
}).strict();

const emptyParametersSchema = z.object({}).strict();

const createOperationEnvelopeSchema = z.object({
  type: z.enum(operationTypes),
  parameters: z.unknown().optional()
}).strict();

export function parseCreateOperationRequest(input: unknown): { type: OperationType; parameters: OperationParameters } {
  const envelope = createOperationEnvelopeSchema.parse(input);
  const rawParameters = envelope.parameters ?? {};

  switch (envelope.type) {
    case "deploy":
      return { type: envelope.type, parameters: deployParametersSchema.parse(rawParameters) };
    case "restart":
    case "stop":
    case "resume":
    case "update-check":
      return { type: envelope.type, parameters: emptyParametersSchema.parse(rawParameters) };
    case "rebuild":
      return { type: envelope.type, parameters: rebuildParametersSchema.parse(rawParameters) };
    case "update":
    case "rollback":
      return { type: envelope.type, parameters: revisionParametersSchema.parse(rawParameters) };
    case "delete":
      return { type: envelope.type, parameters: deleteParametersSchema.parse(rawParameters) };
  }
}
