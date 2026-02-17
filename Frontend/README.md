# Storive - Modern Cloud Storage Solution

A professional file storage and management application built with Next.js, providing secure and efficient cloud storage capabilities.

## ✨ Features

- 📁 **File & Folder Management** - Create, upload, organize, and manage your files with drag-and-drop support
- 🔍 **Advanced Search** - Quickly find files and folders with powerful search functionality
- 👥 **File Sharing** - Share files securely with public links and access controls
- ⭐ **Favorites** - Star important files for quick access
- 🗑️ **Trash & Recovery** - Safely delete and restore files from trash
- 🔒 **Secure Authentication** - Email-based authentication with password reset
- 📊 **Storage Analytics** - Track storage usage across your account
- 🎨 **Modern UI** - Beautiful, responsive interface with dark mode support
- 📱 **Responsive Design** - Works seamlessly on desktop, tablet, and mobile

## 🛠️ Tech Stack

### Frontend
- **Next.js 16** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives
- **Framer Motion** - Smooth animations
- **shadcn/ui** - Beautiful UI components

### Backend
- **Node.js & Express** - RESTful API server
- **Supabase** - Database and storage backend
- **JWT Authentication** - Secure token-based auth
- **Nodemailer** - Email service integration

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Supabase account

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/kanukuntlaanubhav450/Storive.git
   cd Storive
   ```

2. **Install dependencies**
   ```bash
   # Install frontend dependencies
   cd Frontend
   npm install

   # Install backend dependencies
   cd ../Backend
   npm install
   ```

3. **Configure environment variables**

   **Frontend** - Create `Frontend/.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5000
   ```

   **Backend** - Create `Backend/.env`:

   > [!IMPORTANT]
   > **Security Warning:**
   > - `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS policies and is highly privileged.
   > - `JWT_SECRET` must be a strong cryptographically-random value (min 32 chars).
   > - `SMTP_PASS` should be an app-specific password, not your account password.
   > - **Never commit `.env` files to version control.** Use managed secret storage for these values.

   ```env
   PORT=5000
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   JWT_SECRET=your_strong_random_secret_min_32_chars
   SMTP_HOST=smtp.gmail.com
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=your_app_specific_password
   ```

4. **Set up the database**

   Run the following SQL migration files from `Backend/db/migrations/` in the exact order via the Supabase SQL Editor:

   1.  `001_initial_schema.sql` (Creates core tables: users, folders, files, shares, etc.)
   2.  `002_db_setup.sql` (Ensures auth syncing and table constraints)
   3.  `003_empty_trash.sql` (Creates `empty_trash` function)
   4.  `004_secure_otp.sql` (Security hardening for OTPs and cleanup function)
   5.  `005_shares_hardening.sql` (Adds index and constraints to shares)
   6.  `006_folder_uniqueness.sql` (Fixes folder name uniqueness constraints)
   7.  `007_file_version_uniqueness.sql` (Prevents duplicate file versions)

   **Supabase Storage:**
   *   Create a public storage bucket named: **`drive`**
   *   Ensure standard RLS policies are applied to allow authenticated users to upload/download their own files.

   **Supabase Configuration:**
   *   Enable Row Level Security (RLS) on all public tables (`users`, `files`, `folders`, `shares`, `pending_registrations`).
   *   Add policies for `allow_authenticated_select` and `allow_authenticated_insert` where appropriate (matching the owner_id checks in the controllers).
   *   Verify the following functions/triggers exist:
       *   `empty_trash`
       *   `clean_expired_registrations`
       *   `trigger_clean_expired_registrations`

   **Verification:**
   *   Check that tables `users`, `files`, `folders` exist in the Table Editor.
   *   Confirm the `drive` bucket exists in Storage.
   *   Verify SQL functions `empty_trash` and `clean_expired_registrations` are present in the Database > Functions section.

5. **Start the development servers**

   **Backend**:
   ```bash
   cd Backend
   npm run dev
   # Server runs on http://localhost:5000
   ```

   **Frontend**:
   ```bash
   cd Frontend
   npm run dev
   # App runs on http://localhost:3000
   ```

## 📁 Project Structure

```
Storive/
├── Frontend/
│   ├── src/
│   │   ├── app/              # Next.js App Router pages
│   │   ├── components/       # React components
│   │   │   ├── ui/          # Reusable UI components
│   │   │   ├── drive/       # Drive-specific components
│   │   │   └── layout/      # Layout components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── lib/             # Utility functions
│   │   └── services/        # API service layer
│   ├── public/              # Static assets
│   └── package.json
│
└── Backend/
    ├── src/
    │   ├── config/          # Configuration files
    │   ├── controllers/     # Request handlers
    │   ├── middlewares/     # Express middlewares
    │   ├── routes/          # API routes
    │   ├── utils/           # Utility functions
    │   └── validators/      # Input validation
    ├── db/migrations/       # Database schemas
    └── package.json
```

## 🔐 Authentication

The app uses JWT-based authentication with:
- Email/password registration
- Secure login with HTTP-only cookies
- Password reset via email
- Change password functionality
- Protected API routes

## 📝 Available Scripts

### Frontend
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

### Backend
```bash
npm run dev      # Start with nodemon (auto-reload)
npm start        # Start production server
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the ISC License.

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)
- Database & Storage by [Supabase](https://supabase.com/)
