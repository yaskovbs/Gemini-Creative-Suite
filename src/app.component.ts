import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { GenerateComponent } from './components/generate/generate.component';
import { AnalyzeComponent } from './components/analyze/analyze.component';
import { ChatComponent } from './components/chat/chat.component';
import { ApiKeyService } from './services/api-key.service';
import { ApiKeyFormComponent } from './components/api-key-form/api-key-form.component';

type Tab = 'generate' | 'analyze' | 'chat';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GenerateComponent, AnalyzeComponent, ChatComponent, ApiKeyFormComponent],
})
export class AppComponent {
  apiKeyService = inject(ApiKeyService);
  activeTab = signal<Tab>('generate');

  tabs: { id: Tab; name: string; icon: string }[] = [
    { id: 'generate', name: 'Generate', icon: 'sparkles' },
    { id: 'analyze', name: 'Analyze', icon: 'search' },
    { id: 'chat', name: 'Chat', icon: 'chat-alt-2' },
  ];

  selectTab(tab: Tab) {
    this.activeTab.set(tab);
  }
}
