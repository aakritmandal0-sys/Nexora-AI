# Nexora AI - Vercel Deployment Guide

This project is ready to be deployed on Vercel.

## Deployment Steps

1.  **Push to GitHub**: Push your code to a GitHub repository.
2.  **Import to Vercel**: Go to [Vercel](https://vercel.com) and import your repository.
3.  **Configure Environment Variables**:
    In the Vercel project settings, add the following environment variables:
    -   `GEMINI_API_KEY`: Your Google Gemini API Key.
    -   (Optional) `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, etc. (See `.env.example` for the full list). If these are not set, the app will use the values from `firebase-applet-config.json`.
4.  **Deploy**: Vercel will automatically detect the Vite configuration and deploy your app.

## Project Configuration

-   **Build Command**: `npm run build`
-   **Output Directory**: `dist`
-   **Framework Preset**: Vite

## SPA Routing

A `vercel.json` file has been included to ensure that all routes are correctly handled by the Single Page Application (SPA) logic.
