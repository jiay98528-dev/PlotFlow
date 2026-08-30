import type { PlotFlowData } from '../types/ast.js';
import type { Diagnostic } from '../types/diagnostic.js';
import { checkAllErrors } from '../validator/validator.js';

/** Structural errors that can be derived from the AST without parser context. */
export function checkExportStructure(data: PlotFlowData): Diagnostic[] {
  return checkAllErrors(data);
}
