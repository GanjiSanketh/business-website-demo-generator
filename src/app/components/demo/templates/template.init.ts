import { registerTemplateComponent } from './template.registry';
import { Salon01Component } from '../salon01/salon01.component';
import { Salon02Component } from './salon02/salon02.component';
import { Restaurant01Component } from './restaurant01/restaurant01.component';
import { Restaurant02Component } from './restaurant02/restaurant02.component';

registerTemplateComponent('salon-01', Salon01Component);
registerTemplateComponent('salon-02', Salon02Component);
registerTemplateComponent('restaurant-01', Restaurant01Component);
registerTemplateComponent('restaurant-02', Restaurant02Component);
