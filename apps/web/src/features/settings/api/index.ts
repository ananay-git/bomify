import api from "@/lib/axios";

// ─── Types ─────────────────────────────────────────────────────

export interface SettingItem {
    id: number;
    category: string;
    key: string;
    value: any;
    description: string | null;
    updated_by: string | null;
}

export interface SettingsGrouped {
    [category: string]: {
        [key: string]: any;
    };
}

export interface SettingUpdatePayload {
    category: string;
    key: string;
    value: any;
}

// ─── API Methods ───────────────────────────────────────────────

export const settingsApi = {
    /** Get all settings grouped by category */
    getAll: async (): Promise<SettingsGrouped> => {
        const response = await api.get<{ settings: SettingsGrouped }>("/settings/");
        return response.data.settings;
    },

    /** Get all settings with full detail (id, description, etc.) */
    getAllFull: async (): Promise<SettingItem[]> => {
        const response = await api.get<{ settings: SettingItem[] }>("/settings/full");
        return response.data.settings;
    },

    /** Get settings for a specific category */
    getByCategory: async (category: string): Promise<Record<string, any>> => {
        const response = await api.get<{ category: string; settings: Record<string, any> }>(
            `/settings/${category}`
        );
        return response.data.settings;
    },

    /** Bulk update multiple settings */
    bulkUpdate: async (settings: SettingUpdatePayload[]): Promise<{ message: string; updated: number }> => {
        const response = await api.put<{ message: string; updated: number }>("/settings/", {
            settings,
        });
        return response.data;
    },

    /** Update a single setting */
    update: async (category: string, key: string, value: any): Promise<SettingItem> => {
        const response = await api.put<SettingItem>(`/settings/${category}/${key}`, {
            category,
            key,
            value,
        });
        return response.data;
    },
};
