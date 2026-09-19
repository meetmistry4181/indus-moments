import { supabase } from "./supabase";

export async function getCurrentUserRole() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Unable to get user role:", error);
    return null;
  }

  return data?.role ?? null;
}

export async function isAdmin() {
  const role = await getCurrentUserRole();

  return role === "admin";
}

export async function isPhotographer() {
  const role = await getCurrentUserRole();

  return role === "photographer" || role === "admin";
}