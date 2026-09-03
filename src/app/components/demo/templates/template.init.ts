import { registerTemplateComponent } from './template.registry';
import { Salon01Component } from '../salon01/salon01.component';
import { Salon02Component } from './salon02/salon02.component';

registerTemplateComponent('salon-01', Salon01Component);
registerTemplateComponent('salon-02', Salon02Component);