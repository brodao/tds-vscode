import * as vscode from 'vscode';
import { TextDocument, FormattingOptions, CancellationToken, ProviderResult, TextEdit, DocumentRangeFormattingEditProvider } from 'vscode';

export class AdvplDocumentRangeFormatting implements DocumentRangeFormattingEditProvider {

	provideDocumentRangeFormattingEdits(document: TextDocument, range: vscode.Range, options: FormattingOptions, token: CancellationToken): ProviderResult<TextEdit[]> {
		throw new Error("Method not implemented.");
	}
}

