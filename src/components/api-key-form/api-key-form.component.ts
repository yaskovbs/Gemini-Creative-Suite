import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiKeyService } from '../../services/api-key.service';

@Component({
  selector: 'app-api-key-form',
  imports: [ReactiveFormsModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div class="w-full max-w-lg p-8 space-y-8 bg-gray-800 rounded-2xl shadow-2xl">
        <div class="text-center">
            <svg class="mx-auto h-12 w-12 text-gemini-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
            </svg>
          <h2 class="mt-6 text-3xl font-bold tracking-tight text-white">
            Enter Your Gemini API Key
          </h2>
          <p class="mt-2 text-sm text-gray-400">
            You can get your API key from 
            <a href="https://aistudio.google.com/app/apikey" target="_blank" class="font-medium text-gemini-blue hover:underline">
              Google AI Studio
            </a>.
          </p>
        </div>
        <form [formGroup]="keyForm" (ngSubmit)="saveKey()" class="mt-8 space-y-6">
          <div class="rounded-md shadow-sm -space-y-px">
            <div>
              <label for="api-key" class="sr-only">API Key</label>
              <input formControlName="apiKey" id="api-key" name="apiKey" type="password" required
                     class="appearance-none rounded-md relative block w-full px-3 py-3 border border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-gemini-blue focus:border-gemini-blue focus:z-10 sm:text-sm"
                     placeholder="Your Gemini API Key">
            </div>
          </div>

          <div>
            <button type="submit" [disabled]="keyForm.invalid"
                    class="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-gemini-blue hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gemini-blue disabled:bg-gray-600 disabled:cursor-not-allowed">
              Save and Continue
            </button>
          </div>
          <div class="text-xs text-gray-500 text-center">
            <p>Your API key is stored only in your browser's local storage and is not sent anywhere else.</p>
          </div>
        </form>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApiKeyFormComponent {
  private fb = inject(FormBuilder);
  private apiKeyService = inject(ApiKeyService);

  keyForm = this.fb.group({
    apiKey: ['', Validators.required],
  });

  saveKey() {
    if (this.keyForm.valid && this.keyForm.value.apiKey) {
      this.apiKeyService.setApiKey(this.keyForm.value.apiKey);
    }
  }
}
