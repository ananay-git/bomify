/**
 * Parties API hooks — CRUD for Customers and Suppliers.
 */

import api from "@/lib/axios";

export type PartyType = "customer" | "supplier" | "both" | "buyer";

export interface Location {
    id?: number;
    location_type: "billing" | "shipping" | "delivery";
    address_line1: string;
    address_line2?: string | null;
    city: string;
    state?: string | null;
    pincode?: string | null;
    country?: string | null;
    gstin?: string | null;
    is_default?: boolean;
}

export interface PartyContact {
    id?: number;
    contact_name: string;
    email?: string | null;
    phone?: string | null;
    role?: string | null;
}

export interface PartyTag {
    id?: number;
    tag: string;
}

export interface Party {
    id: number;
    party_type: PartyType;
    name: string;
    contact_person: string | null;
    email: string | null;
    email_company?: string | null;
    phone: string | null;
    gstin: string | null;
    gst_type?: string | null;
    address: string | null;
    address1?: string | null;
    address2?: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    country?: string | null;
    payment_terms: string | null;
    notes: string | null;
    reference_code?: string | null;
    status?: string;
    created_at: string;
    updated_at: string;

    locations?: Location[];
    contacts?: PartyContact[];
    tags?: PartyTag[];
}

export interface PartyListResponse {
    parties: Party[];
    total: number;
}

export interface CreatePartyPayload {
    party_type: PartyType;
    name: string;
    contact_person?: string;
    email?: string;
    email_company?: string;
    phone?: string;
    gstin?: string;
    gst_type?: string;
    address?: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
    payment_terms?: string;
    notes?: string;
    reference_code?: string;
}

export interface UpdatePartyPayload extends Partial<CreatePartyPayload> {
    status?: string;
}

// ==========================================
// MAIN PARTY CRUD
// ==========================================

export async function fetchParties(
    partyType?: PartyType,
    search?: string,
    skip = 0,
    limit = 50,
): Promise<PartyListResponse> {
    if (partyType === 'customer' || partyType === 'buyer') {
        const [main, both] = await Promise.all([
            api.get<PartyListResponse>("/parties/", { params: { party_type: 'customer', search, skip, limit } }),
            api.get<PartyListResponse>("/parties/", { params: { party_type: 'both', search, skip, limit } })
        ]);
        return { parties: [...main.data.parties, ...both.data.parties], total: main.data.total + both.data.total };
    }
    
    if (partyType === 'supplier') {
        const [main, both] = await Promise.all([
            api.get<PartyListResponse>("/parties/", { params: { party_type: 'supplier', search, skip, limit } }),
            api.get<PartyListResponse>("/parties/", { params: { party_type: 'both', search, skip, limit } })
        ]);
        return { parties: [...main.data.parties, ...both.data.parties], total: main.data.total + both.data.total };
    }

    const res = await api.get<PartyListResponse>("/parties/", {
        params: { party_type: partyType, search, skip, limit },
    });
    return res.data;
}

export async function fetchPartyById(partyId: number | string): Promise<Party> {
    const res = await api.get<Party>(`/parties/${partyId}`);
    return res.data;
}

export async function createParty(data: CreatePartyPayload): Promise<Party> {
    const res = await api.post<Party>("/parties/", data);
    return res.data;
}

export async function updateParty(
    partyId: number,
    data: UpdatePartyPayload,
): Promise<Party> {
    const res = await api.patch<Party>(`/parties/${partyId}`, data);
    return res.data;
}

export async function deleteParty(partyId: number): Promise<void> {
    await api.delete(`/parties/${partyId}`);
}

// ==========================================
// SUB-ITEMS CRUD (Addresses, Contacts, Tags)
// ==========================================

export async function fetchPartyLocations(partyId: number): Promise<Location[]> {
    const res = await api.get<Location[]>(`/parties/${partyId}/locations`);
    return res.data;
}

export async function addPartyLocation(
    partyId: number,
    data: Location,
): Promise<Location> {
    const res = await api.post<Location>(
        `/parties/${partyId}/locations`,
        data,
    );
    return res.data;
}

export async function updatePartyLocation(
    partyId: number,
    locId: number,
    data: Partial<Location>,
): Promise<Location> {
    const res = await api.patch<Location>(
        `/parties/${partyId}/locations/${locId}`,
        data,
    );
    return res.data;
}

export async function deletePartyLocation(
    partyId: number,
    locId: number,
): Promise<void> {
    await api.delete(`/parties/${partyId}/locations/${locId}`);
}

export async function addPartyContact(
    partyId: number,
    data: PartyContact,
): Promise<PartyContact> {
    const res = await api.post<PartyContact>(
        `/parties/${partyId}/contacts`,
        data,
    );
    return res.data;
}

export async function updatePartyContact(
    partyId: number,
    contactId: number,
    data: Partial<PartyContact>,
): Promise<PartyContact> {
    const res = await api.patch<PartyContact>(
        `/parties/${partyId}/contacts/${contactId}`,
        data,
    );
    return res.data;
}

export async function deletePartyContact(
    partyId: number,
    contactId: number,
): Promise<void> {
    await api.delete(`/parties/${partyId}/contacts/${contactId}`);
}

export async function addPartyTag(
    partyId: number,
    tag: string,
): Promise<PartyTag> {
    const res = await api.post<PartyTag>(`/parties/${partyId}/tags`, { tag });
    return res.data;
}

export async function deletePartyTag(
    partyId: number,
    tagId: number,
): Promise<void> {
    await api.delete(`/parties/${partyId}/tags/${tagId}`);
}
