import { registerTemplateComponent } from './template.registry';
import { Salon01Component } from '../salon01/salon01.component';
import { Salon02Component } from './salon02/salon02.component';
import { Restaurant01Component } from './restaurant01/restaurant01.component';
import { Restaurant02Component } from './restaurant02/restaurant02.component';
import { Gym01Component } from './gym01/gym01.component';
import { Gym02Component } from './gym02/gym02.component';
import { Clothing01Component } from './clothing01/clothing01.component';
import { Clothing02Component } from './clothing02/clothing02.component';

registerTemplateComponent('salon-01', Salon01Component);
registerTemplateComponent('salon-02', Salon02Component);
registerTemplateComponent('restaurant-01', Restaurant01Component);
registerTemplateComponent('restaurant-02', Restaurant02Component);
registerTemplateComponent('gym-01', Gym01Component);
registerTemplateComponent('gym-02', Gym02Component);
registerTemplateComponent('clothing-01', Clothing01Component);
registerTemplateComponent('clothing-02', Clothing02Component);
