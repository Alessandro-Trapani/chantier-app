import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://nllxsrdpuuldkcjwebpw.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sbHhzcmRwdXVsZGtjandlYnB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUzNDU2NDgsImV4cCI6MjA2MDkyMTY0OH0.K9BRouWwbUtsBFIsBKPaBd2CLCtmAn2Xn6h7-MOb8VM";

export const supabase = createClient(supabaseUrl, supabaseKey);
