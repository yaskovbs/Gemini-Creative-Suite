import { ChangeDetectionStrategy, Component, inject, signal, WritableSignal, ElementRef, viewChild, afterNextRender } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { GeminiService, ChatHistory, GroundingChunk } from '../../services/gemini.service';
import { GenerateContentResponse } from '@google/genai';

type ChatMode = 'thinking' | 'search';
type Status = 'idle' | 'loading' | 'error';
interface DisplayMessage extends ChatHistory {
  id: number;
  groundingChunks?: GroundingChunk[];
}


@Component({
  selector: 'app-chat',
  imports: [ReactiveFormsModule],
  templateUrl: './chat.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatComponent {
  private fb = inject(FormBuilder);
  private geminiService = inject(GeminiService);

  mode: WritableSignal<ChatMode> = signal('thinking');
  status: WritableSignal<Status> = signal('idle');
  error: WritableSignal<string | null> = signal(null);

  messages: WritableSignal<DisplayMessage[]> = signal([]);
  
  chatContainer = viewChild<ElementRef<HTMLDivElement>>('chatContainer');
  
  chatForm = this.fb.group({
    message: ['', Validators.required],
  });

  constructor() {
    afterNextRender(() => {
        this.scrollToBottom();
    });
  }

  setMode(newMode: ChatMode) {
    this.mode.set(newMode);
    this.resetState();
  }

  async sendMessage() {
    if (this.chatForm.invalid) return;

    this.status.set('loading');
    this.error.set(null);
    const userInput = this.chatForm.value.message!;
    
    // Add user message to display
    this.messages.update(current => [
        ...current, 
        { id: Date.now(), role: 'user', parts: [{ text: userInput }] }
    ]);
    this.chatForm.reset();
    this.scrollToBottom();

    // Prepare history for API
    const history: ChatHistory[] = this.messages().slice(0, -1).map(({role, parts}) => ({role, parts}));

    try {
      const stream = this.mode() === 'thinking'
        ? await this.geminiService.chatWithThinking(history, userInput)
        : await this.geminiService.chatWithSearch(history, userInput);

      let modelResponse = '';
      let groundingChunks: GroundingChunk[] = [];
      const modelMessageId = Date.now();
      
      // Add a placeholder for model response
      this.messages.update(current => [
          ...current, 
          { id: modelMessageId, role: 'model', parts: [{ text: '' }] }
      ]);

      for await (const chunk of stream) {
        modelResponse += chunk.text;
        if(chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
            groundingChunks.push(...chunk.candidates[0].groundingMetadata.groundingChunks as GroundingChunk[]);
        }
        
        this.messages.update(current => current.map(m => 
            m.id === modelMessageId ? {...m, parts: [{ text: modelResponse }], groundingChunks } : m
        ));
        this.scrollToBottom();
      }

      this.status.set('idle');
    } catch (e: any) {
      console.error(e);
      this.error.set(e.message || 'An unknown error occurred.');
      this.status.set('error');
    }
  }

  private resetState() {
    this.status.set('idle');
    this.error.set(null);
    this.messages.set([]);
  }
  
  private scrollToBottom(): void {
    setTimeout(() => {
        try {
            if (this.chatContainer()) {
                const element = this.chatContainer()!.nativeElement;
                element.scrollTop = element.scrollHeight;
            }
        } catch (err) { }
    }, 10);
  }
}
