import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'SenseAI — See more. Understand more.', description: 'A private, browser-powered visual assistant with live object detection, text recognition, and speech.' };
export default function Layout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
