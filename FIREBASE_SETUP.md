# Firebase Setup Guide

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add Project" or select an existing project
3. Follow the setup wizard

## Step 2: Enable Firestore Database

1. In your Firebase project, go to **Firestore Database**
2. Click **Create Database**
3. Start in **test mode** (for development) or **production mode** (with security rules)
4. Choose a location for your database

## Step 3: Get Firebase Configuration

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to **Your apps** section
3. Click the **Web** icon (`</>`) to add a web app
4. Register your app with a nickname (e.g., "MB HAAT Feedback")
5. Copy the Firebase configuration object

## Step 4: Update Configuration in script.js

Open `script.js` and replace the placeholder values in `firebaseConfig`:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",                    // Replace with your API key
  authDomain: "YOUR_AUTH_DOMAIN",            // Replace with your auth domain
  projectId: "YOUR_PROJECT_ID",              // Replace with your project ID
  storageBucket: "YOUR_STORAGE_BUCKET",      // Replace with your storage bucket
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID", // Replace with your sender ID
  appId: "YOUR_APP_ID"                       // Replace with your app ID
};
```

## Step 5: Set Up Firestore Security Rules (Recommended)

In Firebase Console → Firestore Database → Rules, add:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read access to ratings
    match /ratings/{document=**} {
      allow read: if true;
      allow write: if request.auth != null || true; // For public write, use: if true
    }
  }
}
```

**Note:** For production, implement proper authentication and security rules.

## Step 6: Test the Integration

1. Open `index.html` in a browser
2. Open browser console (F12)
3. You should see "Firebase initialized successfully"
4. Try submitting a rating to verify it saves to Firestore

## Database Structure

The app creates a `ratings` collection with documents like:

```javascript
{
  stallId: "spice-scoo",
  stars: 5,
  rating: 5,
  userName: "Priya Singh",
  userCourse: "BSc 2nd Year",
  reaction: "🔥 You loved it!",
  timestamp: Timestamp,
  createdAt: "2025-01-XX..."
}
```

## Features

- ✅ Ratings are stored in Firestore
- ✅ Summary is calculated from Firestore data
- ✅ Export function downloads all ratings from Firestore
- ✅ Admin can reset all ratings (deletes from Firestore)
- ✅ Real-time data persistence

## Troubleshooting

- **"Firebase not configured"**: Check that you've updated `firebaseConfig` with your actual values
- **"Firebase SDK not loaded"**: Ensure the Firebase script tags are in `index.html` before `script.js`
- **Permission errors**: Check Firestore security rules in Firebase Console
- **Network errors**: Verify your Firebase project is active and billing is enabled (if required)

