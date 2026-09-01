# Business Website Demo Generator

An internal tool for quickly generating personalized website demos for business prospects. Enter business details, select a template, and generate a beautiful demo website that can be shared with potential clients.

## Technology Stack

- **Angular 21** — Frontend framework with standalone components and signals
- **TypeScript 5.9** — Type-safe development
- **Bootstrap 5** + **Bootstrap Icons** — UI components and icon library
- **Firebase** — Backend services
  - Firebase Authentication (Email/Password)
  - Cloud Firestore (Database)
  - Firebase Storage (File uploads)

## Architecture

```
src/
├── app/
│   ├── models/
│   │   └── business.model.ts          # Business data interface
│   ├── services/
│   │   ├── auth.service.ts            # Firebase Auth wrapper
│   │   ├── business.service.ts        # Firestore CRUD operations
│   │   └── storage.service.ts         # Firebase Storage uploads
│   ├── guards/
│   │   └── auth.guard.ts              # Route protection
│   ├── components/
│   │   ├── login/                     # Admin login page
│   │   ├── admin/
│   │   │   ├── layout/                # Admin shell with sidebar
│   │   │   ├── dashboard/             # Business list + stats
│   │   │   └── business-form/         # Create/Edit form
│   │   └── demo/
│   │       ├── demo-page/             # Demo route handler
│   │       └── salon01/               # Salon 01 template
│   └── environment/
│       └── environment.ts             # Firebase config
```

## Firebase Setup

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **Add Project**
3. Enter a project name (e.g., `business-demo-generator`)
4. Disable Google Analytics (optional) and create

### 2. Enable Authentication

1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Enable **Email/Password** provider
3. Go to **Users** tab and add an admin user:
   - Email: your admin email
   - Password: your chosen password

### 3. Create Firestore Database

1. Go to **Firestore Database** → **Create database**
2. Choose **Start in test mode** (we'll add security rules later)
3. Select your preferred region

### 4. Enable Firebase Storage

1. Go to **Storage** → **Get started**
2. Choose **Start in test mode**
3. Select your preferred region

### 5. Get Firebase Configuration

1. Go to **Project Settings** (gear icon) → **General**
2. Under **Your apps**, click the web icon (`</>`) to add a web app
3. Register the app with a nickname
4. Copy the `firebaseConfig` object values

### 6. Configure the Application

Open `src/app/environment/environment.ts` and replace the placeholder values:

```typescript
export const environment = {
  production: false,
  firebase: {
    apiKey: "YOUR_ACTUAL_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID",
  },
};
```

## Local Development

```bash
# Install dependencies
npm install

# Start development server
ng serve

# Build for production
ng build
```

The application will be available at `http://localhost:4200`.

## Firestore Security Rules

After confirming the app works in test mode, update your Firestore rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Admin can read/write all businesses
    match /businesses/{businessId} {
      // Public can only read published businesses
      allow read: if resource.data.status == 'published';
      // Only authenticated users can write
      allow write: if request.auth != null;
    }
  }
}
```

## Firebase Storage Security Rules

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /businesses/{businessId}/{allPaths=**} {
      // Public can read published business files
      allow read: if true;
      // Only authenticated users can upload
      allow write: if request.auth != null;
    }
  }
}
```

## How to Create a Business

1. Navigate to `http://localhost:4200/login`
2. Sign in with your Firebase admin credentials
3. Click **New Business** or **Create Business**
4. Fill in business details:
   - Business name (required)
   - Category (Salon, Restaurant, Gym, Local Service)
   - Template (Salon 01 available, others coming soon)
   - Contact info (phone, WhatsApp, address)
   - Upload logo and images
   - Add services
5. Set status to **Published** when ready
6. Click **Create Business**
7. Copy the demo URL or click **Open Demo**

## How Demo URLs Work

- Demo URLs follow the pattern: `/demo/{slug}`
- The slug is auto-generated from the business name
- Example: "ABC Salon" → `/demo/abc-salon`
- Only **published** businesses are accessible via demo URLs
- Draft businesses return a "not found" message

## Templates

| Template | Status |
|----------|--------|
| Salon 01 | ✅ Available |
| Restaurant 01 | 🔜 Coming Soon |
| Gym 01 | 🔜 Coming Soon |
| Local Service 01 | 🔜 Coming Soon |

## Production Build

```bash
# Build for production
ng build --configuration production

# Output will be in dist/business-demo-generator/browser/
```

## Project Structure

- **Admin routes** (`/admin/*`) — Protected by auth guard, requires login
- **Demo routes** (`/demo/:slug`) — Public, displays the generated website
- **Login route** (`/login`) — Admin authentication page

## Environment Variables

| Variable | Description |
|----------|-------------|
| `apiKey` | Firebase API key |
| `authDomain` | Firebase auth domain |
| `projectId` | Firebase project ID |
| `storageBucket` | Firebase storage bucket |
| `messagingSenderId` | Firebase messaging sender ID |
| `appId` | Firebase app ID |

## License

Private — Internal use only.
