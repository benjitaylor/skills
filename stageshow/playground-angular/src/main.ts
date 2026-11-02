import { bootstrapApplication } from '@angular/platform-browser'
import { provideZonelessChangeDetection } from '@angular/core'
import { Playground } from './playground'

bootstrapApplication(Playground, { providers: [provideZonelessChangeDetection()] }).catch((e) => console.error(e))
