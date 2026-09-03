"use client";

import { supabase } from "./supabase";

// Thin wrapper around Supabase Realtime's postgres_changes: instead of merging
// individual INSERT/UPDATE/DELETE payloads into local state (easy to get subtly
// wrong -- partial rows, out-of-order events, missed events while a tab was
// backgrounded), this just re-runs the caller's own existing fetch function whenever
// *anything* changes on the given table+filter. Simple, always-correct-on-next-fetch,
// and reuses the exact same fetch every page already calls on mount.
//
// The same `supabase` client instance is used everywhere in this app (lib/supabase.js),
// including here -- its accessToken() callback already attaches the signed-in user's
// Firebase-derived JWT to this channel's auth, so Realtime enforces the same RLS
// policies as every other request (a doctor only ever receives events for rows they
// could already SELECT).
//
// Fails silently: if this project's tables aren't in the supabase_realtime
// publication yet (see supabase.sql), or the socket can't connect, the page simply
// doesn't get live updates -- it stays exactly as correct as before this existed
// (fetch-on-mount), it just won't refresh itself until the user next navigates here.
export function subscribeToTableChanges({ table, filter, onChange }) {
  let channel;
  try {
    channel = supabase
      .channel(`changes:${table}:${filter || "all"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
        () => {
          try {
            onChange();
          } catch (err) {
            console.error(`[realtime] onChange handler for ${table} failed:`, err);
          }
        }
      )
      .subscribe();
  } catch (err) {
    console.error(`[realtime] failed to subscribe to ${table}:`, err);
    return () => {};
  }

  return () => {
    try {
      supabase.removeChannel(channel);
    } catch {
      // Channel already gone (e.g. connection dropped) -- nothing to clean up.
    }
  };
}
