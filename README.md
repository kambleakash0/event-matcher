# Event Matcher

Event Matcher is an intelligent event networking and matching application built with React, Vite, Firebase, and Google's Gemini AI. It is designed to help event organizers seamlessly pair attendees with relevant sponsors based on their profiles, intentions, and the sponsor's offerings, facilitating valuable networking experiences.

## Key Features

- **Smart AI Matching:** Utilizes Google Gemini to analyze attendee profiles against sponsor profiles to generate highly personalized match scores.
- **Detailed Match Results:** Provides reasoning for matches, conversation starters, suggested questions, and schedules.
- **Batch Processing:** Ability to run smart matching for all attendees at once with progress tracking.
- **Email Integration:** Send personalized match results directly to attendees using EmailJS.
- **Data Management:** Bulk upload attendees and sponsors using CSV files.
- **Real-time Database:** Uses Firebase Firestore for reliable data storage and real-time updates.
- **Modern UI:** A beautiful, responsive, and glassmorphic UI, with a night-mode default theme.

## Tech Stack

- **Frontend:** React 19, React Router v7, Vanilla CSS
- **Build Tool:** Vite
- **Database Backend:** Firebase (Firestore)
- **AI Integrations:** Google Generative AI (Gemini)
- **Email Service:** EmailJS
- **CSV Parsing:** PapaParse

## Getting Started

### Prerequisites

Make sure you have Node.js and npm installed.

You will also need:

- A Firebase project with Firestore enabled.
- An EmailJS account and service configured.
- A Google Gemini API Key.

### Installation

1. Clone the repository:

   ```bash
   git clone <your-repo-url>
   cd event-matcher
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Environment Variables:
   Create a `.env` file in the root directory and add your keys (see `.env.example` if available):

   ```env
   VITE_FIREBASE_API_KEY=your_firebase_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
   VITE_FIREBASE_APP_ID=your_firebase_app_id
   
   VITE_GEMINI_API_KEY=your_gemini_api_key
   VITE_EMAILJS_SERVICE_ID=your_emailjs_service_id
   VITE_EMAILJS_TEMPLATE_ID=your_emailjs_template_id
   VITE_EMAILJS_PUBLIC_KEY=your_emailjs_public_key
   ```

### Running Locally

To start the development server:

```bash
npm run dev
```

The app will typically be available at `http://localhost:5173/`.

### Building for Production

```bash
npm run build
npm run preview
```

## How to Use

1. **Dashboard:** Start on the Admin Dashboard to view your active events.
2. **Add Event:** Use the "+ Add Event" navigation to create a new event.
3. **Upload Data:** Navigate to an Event's Detail page and click the "+ Upload Data" tab to bulk import Attendees and Sponsors via CSV.
4. **Run Matches:**
   - **Single:** Select an individual attendee to view their profile, then click "Run Matching" to generate their personalized sponsor matches.
   - **Batch:** Click "Match All" on the event detail page to automatically process all attendees in batches.
5. **Send Emails:** Once a match is generated, review the AI's suggestions and use the "Send Email" action to notify the attendee.
