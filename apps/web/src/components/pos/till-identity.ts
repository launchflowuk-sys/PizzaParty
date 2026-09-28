"use client";

/** This till's identity for the customer display: a stable id and a name staff can change (Cash & reports → Settings). */
const ID_KEY = "lf-till-id";
const NAME_KEY = "lf-till-name";
export const DEFAULT_TILL_NAME = "Till 1";

function store(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

export function getTillId(): string {
  const s = store();
  let id = s?.getItem(ID_KEY) ?? "";
  if (!id) {
    // randomUUID is missing on a plain-http LAN address (not a secure context).
    id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `till-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    s?.setItem(ID_KEY, id);
  }
  return id;
}

export function getTillName(): string {
  return store()?.getItem(NAME_KEY)?.trim() || DEFAULT_TILL_NAME;
}

export function setTillName(name: string) {
  store()?.setItem(NAME_KEY, name.trim().slice(0, 40) || DEFAULT_TILL_NAME);
}

/** Settings → "Customer confirms on display": Charge hands the order to a paired display first. On unless switched off here. */
const HANDOFF_KEY = "lf-till-handoff";
export function getHandoffPref(): boolean {
  return store()?.getItem(HANDOFF_KEY) !== "0";
}
export function setHandoffPref(on: boolean) {
  store()?.setItem(HANDOFF_KEY, on ? "1" : "0");
}
