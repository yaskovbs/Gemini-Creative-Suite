import { ChangeDetectionStrategy, Component, inject, signal, WritableSignal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { GeminiService } from '../../services/gemini.service';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

type GenerationMode = 'image' | 'video';
type VideoMode = 'text-to-video' | 'image-to-video';
type Status = 'idle' | 'loading' | 'success' | 'error';
type VideoAspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '3:2' | '2:3' | '21:9';

@Component({
  selector: 'app-generate',
  imports: [ReactiveFormsModule],
  templateUrl: './generate.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GenerateComponent {
  private fb = inject(FormBuilder);
  private geminiService = inject(GeminiService);
  private sanitizer = inject(DomSanitizer);

  mode: WritableSignal<GenerationMode> = signal('image');
  videoMode: WritableSignal<VideoMode> = signal('text-to-video');
  status: WritableSignal<Status> = signal('idle');
  error: WritableSignal<string | null> = signal(null);
  
  generatedImageUrl: WritableSignal<string | null> = signal(null);
  generatedVideoUrl: WritableSignal<SafeUrl | null> = signal(null);
  videoLoadingMessage = signal('Initializing video generation...');
  videoProgress = signal(0);

  private uploadedFile = signal<{base64: string, mimeType: string} | null>(null);

  imageForm = this.fb.group({
    prompt: ['', Validators.required],
    width: [1024, [Validators.required, Validators.min(64), Validators.max(2048)]],
    height: [1024, [Validators.required, Validators.min(64), Validators.max(2048)]],
    style: ['none', Validators.required],
  });

  videoForm = this.fb.group({
    prompt: ['', Validators.required],
    aspectRatio: ['16:9' as VideoAspectRatio, Validators.required],
    model: ['veo-2.0-generate-001', Validators.required],
    quality: ['medium', Validators.required],
    imageFile: [null]
  });

  // Imagen 3.0 supports these specific aspect ratios
  private supportedImageAspectRatios = ['1:1', '3:4', '4:3', '9:16', '16:9'];
  
  imageStyles = [
    { value: 'none', label: 'No specific style' },
    { value: 'photorealistic', label: 'Photorealistic' },
    { value: 'cinematic', label: 'Cinematic' },
    { value: 'anime', label: 'Anime' },
    { value: 'watercolor', label: 'Watercolor' },
    { value: 'cyberpunk', label: 'Cyberpunk' },
    { value: 'fantasy', label: 'Fantasy Art' },
    { value: 'pixelart', label: 'Pixel Art' },
    { value: 'minimalist', label: 'Minimalist' },
  ];
  videoAspectRatios: {value: VideoAspectRatio, label: string}[] = [
    { value: '16:9', label: '16:9 (Landscape)'},
    { value: '9:16', label: '9:16 (Portrait)'},
    { value: '1:1', label: '1:1 (Square)'},
    { value: '4:3', label: '4:3 (Standard)'},
    { value: '3:4', label: '3:4 (Standard Portrait)'},
    { value: '3:2', label: '3:2 (Classic Film)'},
    { value: '2:3', label: '2:3 (Classic Portrait)'},
    { value: '21:9', label: '21:9 (Cinematic)'},
  ];
  videoModels = [
    { value: 'veo-2.0-generate-001', label: 'Veo 2.0 (Stable)'},
    { value: 'veo-3.1-fast-generate-preview', label: 'Veo 3.1 Fast (Faster generation)'},
    { value: 'veo-3.1-standard-generate-preview', label: 'Veo 3.1 Standard (Higher quality)'},
  ];
  videoQualities = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
  ];

  setMode(newMode: GenerationMode) {
    this.mode.set(newMode);
    this.resetState();
  }

  setVideoMode(newMode: VideoMode) {
    this.videoMode.set(newMode);
    this.resetState();
  }
  
  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        this.uploadedFile.set({
          base64: result.split(',')[1],
          mimeType: file.type,
        });
      };
      reader.readAsDataURL(file);
    }
  }

  async generate() {
    if (this.mode() === 'image') {
      await this.generateImage();
    } else {
      await this.generateVideo();
    }
  }

  private findClosestAspectRatio(width: number, height: number): string {
    const targetRatio = width / height;

    const ratioMap: {[key: string]: number} = this.supportedImageAspectRatios.reduce((acc, ratioStr) => {
        const [w, h] = ratioStr.split(':').map(Number);
        acc[ratioStr] = w / h;
        return acc;
    }, {} as {[key: string]: number});
    
    let closestRatio = '1:1';
    let minDiff = Infinity;

    for (const [ratioStr, ratioVal] of Object.entries(ratioMap)) {
      const diff = Math.abs(targetRatio - ratioVal);
      if (diff < minDiff) {
        minDiff = diff;
        closestRatio = ratioStr;
      }
    }
    return closestRatio;
  }

  private async generateImage() {
    if (this.imageForm.invalid) return;

    this.status.set('loading');
    this.error.set(null);
    this.generatedImageUrl.set(null);
    const { prompt, width, height, style } = this.imageForm.value;

    const fullPrompt = style && style !== 'none' 
        ? `A ${style} style image of: ${prompt}`
        : prompt;
        
    const aspectRatio = this.findClosestAspectRatio(width!, height!);

    try {
      const imageUrl = await this.geminiService.generateImage(fullPrompt!, aspectRatio);
      this.generatedImageUrl.set(imageUrl);
      this.status.set('success');
    } catch (e) {
      this.handleError(e);
    }
  }

  private async generateVideo() {
    if (this.videoForm.invalid) return;
    if(this.videoMode() === 'image-to-video' && !this.uploadedFile()){
        this.error.set('Please upload an image to animate.');
        return;
    }

    this.status.set('loading');
    this.error.set(null);
    this.generatedVideoUrl.set(null);
    this.videoProgress.set(0);
    const { prompt, aspectRatio, model } = this.videoForm.value;
    const ar = aspectRatio as VideoAspectRatio;

    try {
      this.videoLoadingMessage.set('Sending request to the video generation model...');
      
      let operation;
      if (this.videoMode() === 'text-to-video') {
          operation = await this.geminiService.generateVideoFromText(prompt!, model!, ar);
      } else {
          const file = this.uploadedFile()!;
          operation = await this.geminiService.generateVideoFromImage(prompt!, model!, file.base64, file.mimeType, ar);
      }

      this.videoLoadingMessage.set('Request received. Waiting for processing to start...');
      
      const stream = this.geminiService.pollVideoOperation(operation);
      let result;

      for await (const progressUpdate of stream) {
        this.videoProgress.set(progressUpdate.progress);
        this.videoLoadingMessage.set(`Processing... (State: ${progressUpdate.state})`);
        result = progressUpdate; // Keep the last emission which is the final result
      }
      
      this.videoLoadingMessage.set('Video processing complete. Fetching video data...');
      
      const downloadLink = (result as any).response?.generatedVideos?.[0]?.video?.uri;
      if (!downloadLink) {
        throw new Error('Video generation succeeded, but no download link was provided.');
      }
      
      const apiKey = this.geminiService.getApiKeyForVideoDownload();
      const response = await fetch(`${downloadLink}&key=${apiKey}`);
      if (!response.ok) {
        throw new Error(`Failed to download video: ${response.statusText}`);
      }
      const blob = await response.blob();
      const videoUrl = URL.createObjectURL(blob);

      this.generatedVideoUrl.set(this.sanitizer.bypassSecurityTrustUrl(videoUrl));
      this.status.set('success');
    } catch (e) {
      this.handleError(e);
    }
  }

  private handleError(e: any) {
    console.error(e);
    let errorMessage = e.message || 'An unknown error occurred.';
    
    // Check for common API errors
    if (errorMessage.includes('404')) {
        errorMessage = 'Model not found (404). This usually means the selected model is not available for your API key or region. Try selecting a "Stable" model.';
    } else if (errorMessage.includes('429')) {
        errorMessage = 'Quota exceeded (429). Your API key has reached its usage limit. Please try again later or use a different key.';
    }

    this.error.set(errorMessage);
    this.status.set('error');
  }

  private resetState() {
    this.status.set('idle');
    this.error.set(null);
    this.generatedImageUrl.set(null);
    this.generatedVideoUrl.set(null);
    this.uploadedFile.set(null);
    this.videoProgress.set(0);
    this.imageForm.reset({prompt: '', width: 1024, height: 1024, style: 'none'});
    this.videoForm.reset({prompt: '', aspectRatio: '16:9', imageFile: null, model: 'veo-2.0-generate-001', quality: 'medium'});
  }
}