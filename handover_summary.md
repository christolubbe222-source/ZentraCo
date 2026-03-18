# Zentra Co Handover Summary

This document provides all the context needed to continue the Zentra Co website project with a different model.

## 🚀 Project Overview
**Zentra Co** is a "Growth Infrastructure" agency specializing in high-conversion websites for trade specialists (HVAC, Electricians, Home Inspectors).

### Key Features
- **Premium Design**: Dark mode, glassmorphism, GSAP animations, and custom shader background.
- **Niche Strategy**: Tailored copy and visual mockups for specific trade verticals.
- **Conversion focused**: Integrated lead capture modal that redirects to a booking tool (Calendly).
- **Typography**: Optimized Barlow Condensed for a professional, technical aesthetic.

---

## 📂 Source of Truth
**The most up-to-date and complete file is:**
[zentra_co (1).html](file:///c:/Users/chris/Desktop/ZentraCo/zentra_co%20(1).html)

> [!IMPORTANT]
> Use `zentra_co (1).html` as the master. [index.html](file:///c:/Users/chris/Desktop/ZentraCo/index.html) was in the middle of a synchronization process and may be incomplete.

---

## 🛠️ Technical Stack
- **Frontend**: HTML5, Vanilla CSS3, GSAP (Animations), Three.js/WebGL (Hero Shader).
- **Backend/Database**: Supabase JS SDK.
- **Lead Capture**: Custom modal logic with Supabase `insert`.

---

## 🔑 Backend Setup (Supabase)
The logic is already implemented in the script section of `zentra_co (1).html`.

**Wait for the next model to help with:**
1. **API Keys**: Look for `YOUR_SUPABASE_URL` and `YOUR_SUPABASE_ANON_KEY` in the script tags.
2. **Database Table**: Create a table named `leads` in Supabase with these columns:
   - `id` (int8, primary key)
   - `created_at` (timestamptz, default: now())
   - `full_name` (text)
   - `email` (text)
   - `phone` (text)
   - `status` (text, default: 'new')

---

## 🌐 Go-Live Strategy
The plan is to host on **Hostinger** while managing the domain via **Vercel**.

### Steps for the next model:
1. **Finalize index.html**: Overwrite [index.html](file:///c:/Users/chris/Desktop/ZentraCo/index.html) with the content of `zentra_co (1).html`.
2. **Setup Hostinger**: Upload the finalized [index.html](file:///c:/Users/chris/Desktop/ZentraCo/index.html) and any assets to Hostinger's File Manager (`public_html`).
3. **DNS Configuration**:
   - Point the Vercel domain to Hostinger using **A Records** (using Hostinger's IP) and **CNAME**.
4. **Verification**: Confirm SSL is active on Hostinger and test the lead form to ensure data flows to Supabase.

---

## ✅ Progress Tracking
Refer to [task.md](file:///C:/Users/chris/.gemini/antigravity/brain/17975bb7-a950-4116-b788-8716c464abe7/task.md) for a detailed breakdown of completed and pending phases.
