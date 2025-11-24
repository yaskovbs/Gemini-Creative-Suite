import { Injectable, inject } from '@angular/core';
import { GoogleGenAI, GenerateContentResponse, Chat, Type } from '@google/genai';
import { ApiKeyService } from './api-key.service';

// Define a type for the chat history
export interface ChatHistory {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  }
}

export interface VideoProgress {
    progress: number;
    state: string;
}

@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  private apiKeyService = inject(ApiKeyService);
  private ai: GoogleGenAI | null = null;
  private currentApiKey: string | null = null;

  private getAiClient(): GoogleGenAI {
    const apiKey = this.apiKeyService.apiKey();
    if (!apiKey) {
      throw new Error('API Key is not set.');
    }
    
    if (!this.ai || this.currentApiKey !== apiKey) {
        this.ai = new GoogleGenAI({ apiKey });
        this.currentApiKey = apiKey;
    }
    return this.ai;
  }

  async generateImage(prompt: string, aspectRatio: string): Promise<string> {
    const ai = this.getAiClient();
    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-001',
      prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: aspectRatio as any,
      },
    });

    const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
    return `data:image/jpeg;base64,${base64ImageBytes}`;
  }

  async generateVideoFromText(prompt: string, model: string, aspectRatio: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '3:2' | '2:3' | '21:9') {
     const ai = this.getAiClient();
     let operation = await ai.models.generateVideos({
        model,
        prompt,
        config: {
            numberOfVideos: 1,
            aspectRatio,
        }
     });
     return operation;
  }

  async generateVideoFromImage(prompt: string, model: string, imageBase64: string, mimeType: string, aspectRatio: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '3:2' | '2:3' | '21:9') {
    const ai = this.getAiClient();
    let operation = await ai.models.generateVideos({
        model,
        prompt,
        image: {
            imageBytes: imageBase64,
            mimeType,
        },
        config: {
            numberOfVideos: 1,
            aspectRatio,
        }
    });
    return operation;
  }
  
  async* pollVideoOperation(operation: any): AsyncGenerator<VideoProgress, any> {
    const ai = this.getAiClient();
    let polledOperation = operation;
    while (!polledOperation.done) {
        const metadata = polledOperation.metadata;
        if (metadata?.progressPercent) {
            yield { progress: metadata.progressPercent, state: metadata.state };
        }
        await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5 seconds
        polledOperation = await ai.operations.getVideosOperation({ operation: polledOperation });
    }
    yield { progress: 100, state: 'COMPLETED' };
    return polledOperation;
  }

  async analyzeImage(prompt: string, imageBase64: string, mimeType: string): Promise<string> {
    const ai = this.getAiClient();
    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: imageBase64,
      },
    };
    const textPart = { text: prompt };

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash', 
      contents: { parts: [textPart, imagePart] },
    });

    return response.text;
  }

  async analyzeVideo(prompt: string, videoBase64: string, mimeType: string): Promise<string> {
    const ai = this.getAiClient();
    const videoPart = {
      inlineData: {
        mimeType: mimeType,
        data: videoBase64,
      },
    };
    const textPart = { text: prompt };

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: { parts: [textPart, videoPart] },
    });

    return response.text;
  }
  
  async chatWithThinking(history: ChatHistory[], message: string): Promise<AsyncGenerator<GenerateContentResponse>> {
    const ai = this.getAiClient();
    const chat = ai.chats.create({
      model: 'gemini-2.0-flash',
      config: {
         // thinkingConfig is model specific.
      },
      history
    });
    return chat.sendMessageStream({ message });
  }

  async chatWithSearch(history: ChatHistory[], message: string): Promise<AsyncGenerator<GenerateContentResponse>> {
    const ai = this.getAiClient();
    const chat = ai.chats.create({
      model: 'gemini-2.0-flash',
      config: {
        tools: [{googleSearch: {}}],
      },
      history
    });
    return chat.sendMessageStream({ message });
  }



  getApiKeyForVideoDownload(): string {
    const apiKey = this.apiKeyService.apiKey();
    if (!apiKey) {
      throw new Error('API Key is not set for video download.');
    }
    return apiKey;
  }
}