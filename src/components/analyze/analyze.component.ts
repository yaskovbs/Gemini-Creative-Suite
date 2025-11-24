import { ChangeDetectionStrategy, Component, inject, signal, WritableSignal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { GeminiService } from '../../services/gemini.service';
import { AnalysisHistoryService, AnalysisHistoryItem } from '../../services/analysis-history.service';

type AnalyzeMode = 'image' | 'video';
type Status = 'idle' | 'loading' | 'success' | 'error';

@Component({
  selector: 'app-analyze',
  imports: [ReactiveFormsModule],
  templateUrl: './analyze.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyzeComponent {
  private fb = inject(FormBuilder);
  private geminiService = inject(GeminiService);
  private analysisHistoryService = inject(AnalysisHistoryService);

  mode: WritableSignal<AnalyzeMode> = signal('image');
  status: WritableSignal<Status> = signal('idle');
  error: WritableSignal<string | null> = signal(null);
  result: WritableSignal<string | null> = signal(null);
  
  history = this.analysisHistoryService.history;

  private uploadedFile = signal<{base64: string, mimeType: string, name: string} | null>(null);
  private selectedHistoryItem = signal<AnalysisHistoryItem | null>(null);

  analysisForm = this.fb.group({
    prompt: ['', Validators.required],
    mediaFile: [null, Validators.required],
  });

  setMode(newMode: AnalyzeMode) {
    this.mode.set(newMode);
    this.resetState();
  }

  onFileChange(event: Event) {
    this.selectedHistoryItem.set(null); // Clear history selection on new file upload
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
       // For large videos, this can freeze the browser. Add a check.
      if (file.type.startsWith('video/') && file.size > 20 * 1024 * 1024) { // 20 MB limit
        this.error.set('Video file is too large (max 20MB for browser-based analysis). Please choose a smaller file.');
        this.analysisForm.get('mediaFile')?.setValue(null);
        return;
      }
      this.error.set(null);
      const reader = new FileReader();
      reader.onloadstart = () => this.status.set('loading');
      reader.onload = () => {
        const result = reader.result as string;
        this.uploadedFile.set({
          base64: result.split(',')[1],
          mimeType: file.type,
          name: file.name
        });
        this.status.set('idle');
      };
      reader.onerror = () => {
        this.error.set('Failed to read the file.');
        this.status.set('error');
      }
      reader.readAsDataURL(file);
    }
  }

  async analyze() {
    if (this.analysisForm.invalid || !this.uploadedFile()) {
        this.error.set("Please upload a file and provide a prompt.");
        return;
    }

    this.status.set('loading');
    this.error.set(null);
    this.result.set(null);
    this.selectedHistoryItem.set(null);
    const { prompt } = this.analysisForm.value;
    const file = this.uploadedFile()!;

    try {
        let analysisResult = '';
        if (this.mode() === 'image') {
            analysisResult = await this.geminiService.analyzeImage(prompt!, file.base64, file.mimeType);
        } else {
            analysisResult = await this.geminiService.analyzeVideo(prompt!, file.base64, file.mimeType);
        }
        this.result.set(analysisResult);
        this.status.set('success');

        // Save to history
        this.analysisHistoryService.addHistoryItem({
            id: Date.now(),
            prompt: prompt!,
            fileName: file.name,
            mode: this.mode(),
            result: analysisResult,
            timestamp: new Date()
        });
    } catch (e: any) {
        console.error(e);
        this.error.set(e.message || 'An unknown error occurred during analysis.');
        this.status.set('error');
    }
  }

  loadFromHistory(item: AnalysisHistoryItem) {
    this.setMode(item.mode);
    this.analysisForm.get('prompt')?.setValue(item.prompt);
    this.analysisForm.get('mediaFile')?.setValue(null);
    this.analysisForm.get('mediaFile')?.setValidators(null); // Allow re-running without re-uploading
    this.analysisForm.updateValueAndValidity();
    
    this.uploadedFile.set({
        name: item.fileName,
        base64: '', // We don't have the base64, so analysis requires re-upload
        mimeType: ''
    });
    this.result.set(item.result);
    this.status.set('success');
    this.selectedHistoryItem.set(item);
    this.error.set('To re-run this analysis, please re-upload the original file: ' + item.fileName);
  }

  clearHistory() {
    this.analysisHistoryService.clearHistory();
  }

  private resetState() {
    this.status.set('idle');
    this.error.set(null);
    this.result.set(null);
    this.uploadedFile.set(null);
    this.selectedHistoryItem.set(null);
    this.analysisForm.reset();
    this.analysisForm.get('mediaFile')?.setValidators(Validators.required);
    this.analysisForm.updateValueAndValidity();
  }
}
