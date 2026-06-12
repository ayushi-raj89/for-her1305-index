// Supabase Client Manager
let supabase = null;
let isDemoMode = true;

// Initialize Supabase Client
function initSupabase() {
    const url = localStorage.getItem('SUPABASE_URL') || window.SUPABASE_URL;
    const key = localStorage.getItem('SUPABASE_ANON_KEY') || window.SUPABASE_ANON_KEY;
    
    if (url && key && url.trim() !== "" && key.trim() !== "") {
        try {
            supabase = window.supabase.createClient(url.trim(), key.trim());
            isDemoMode = false;
            console.log("Supabase successfully initialized.");
        } catch (e) {
            console.error("Failed to initialize Supabase client:", e);
            supabase = null;
            isDemoMode = true;
        }
    } else {
        supabase = null;
        isDemoMode = true;
        console.log("Supabase URL or Key missing. Running in Demo Mode.");
    }
    
    // Dispatch custom event to notify app state has changed
    document.dispatchEvent(new CustomEvent('supabase-status-changed', { 
        detail: { isDemoMode, url, key } 
    }));
}

// Save dynamic credentials
function saveSupabaseCredentials(url, key) {
    if (url && key && url.trim() !== "" && key.trim() !== "") {
        localStorage.setItem('SUPABASE_URL', url.trim());
        localStorage.setItem('SUPABASE_ANON_KEY', key.trim());
    } else {
        localStorage.removeItem('SUPABASE_URL');
        localStorage.removeItem('SUPABASE_ANON_KEY');
    }
    initSupabase();
}

// Check connection settings
async function testSupabaseConnection(url, key) {
    try {
        if (!window.supabase) {
            return { success: false, message: "Supabase library not loaded. Check your internet connection." };
        }
        const tempClient = window.supabase.createClient(url.trim(), key.trim());
        
        // Use Promise.race to enforce a 5-second timeout on the network request
        const fetchPromise = tempClient.from('memories').select('id').limit(1);
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Connection timed out. Check if your URL is correct.")), 5000)
        );
        
        const { error } = await Promise.race([fetchPromise, timeoutPromise]);
        
        if (error) {
            console.log("Supabase connection check returned an error:", error);
            
            // Check for invalid API key / unauthorized (401 status or message match)
            if (error.message && (error.message.includes('Invalid API key') || error.message.includes('JWT') || error.code === '401' || error.status === 401)) {
                return { success: false, message: "Invalid Anon Key / API key." };
            }
            
            // Check for direct network failure
            if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('TypeError'))) {
                return { success: false, message: "Network fetch failed. Verify your project URL." };
            }
        }
        return { success: true };
    } catch (e) {
        console.error("Connection test failed with exception:", e);
        return { success: false, message: e.message || "Invalid connection details." };
    }
}

// File Storage Upload
async function uploadFile(bucket, file) {
    if (isDemoMode || !supabase) {
        throw new Error("Supabase is in Demo Mode. Connect to upload files.");
    }
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
        });

    if (error) {
        throw error;
    }

    const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

    return publicUrl;
}

// File Storage Delete from URL
async function deleteFileFromUrl(bucket, fileUrl) {
    if (isDemoMode || !supabase || !fileUrl) return;
    try {
        const urlObj = new URL(fileUrl);
        const pathParts = urlObj.pathname.split('/');
        // Format of publicUrl is: .../storage/v1/object/public/[bucketName]/[fileName]
        // Get the last segment
        const fileName = pathParts[pathParts.length - 1];
        if (fileName) {
            const { error } = await supabase.storage.from(bucket).remove([fileName]);
            if (error) {
                console.error(`Failed to delete file ${fileName} from ${bucket}:`, error.message);
            }
        }
    } catch (e) {
        console.error(`Error parsing file URL to delete:`, e);
    }
}

// --- Memories CRUD ---
async function dbGetMemories() {
    if (isDemoMode || !supabase) return null;
    const { data, error } = await supabase
        .from('memories')
        .select('*')
        .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
}

async function dbAddMemory(memory) {
    if (isDemoMode || !supabase) throw new Error("Demo Mode");
    const { data, error } = await supabase
        .from('memories')
        .insert([memory])
        .select();
    if (error) throw error;
    return data[0];
}

async function dbUpdateMemory(id, memory) {
    if (isDemoMode || !supabase) throw new Error("Demo Mode");
    const { data, error } = await supabase
        .from('memories')
        .update(memory)
        .eq('id', id)
        .select();
    if (error) throw error;
    return data[0];
}

async function dbDeleteMemory(id, imageUrl) {
    if (isDemoMode || !supabase) throw new Error("Demo Mode");
    const { error } = await supabase
        .from('memories')
        .delete()
        .eq('id', id);
    if (error) throw error;

    if (imageUrl) {
        await deleteFileFromUrl('memories', imageUrl);
    }
}

// --- Reasons CRUD ---
async function dbGetReasons() {
    if (isDemoMode || !supabase) return null;
    const { data, error } = await supabase
        .from('reasons')
        .select('*')
        .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
}

async function dbAddReason(reason) {
    if (isDemoMode || !supabase) throw new Error("Demo Mode");
    const { data, error } = await supabase
        .from('reasons')
        .insert([reason])
        .select();
    if (error) throw error;
    return data[0];
}

async function dbUpdateReason(id, reason) {
    if (isDemoMode || !supabase) throw new Error("Demo Mode");
    const { data, error } = await supabase
        .from('reasons')
        .update(reason)
        .eq('id', id)
        .select();
    if (error) throw error;
    return data[0];
}

async function dbDeleteReason(id) {
    if (isDemoMode || !supabase) throw new Error("Demo Mode");
    const { error } = await supabase
        .from('reasons')
        .delete()
        .eq('id', id);
    if (error) throw error;
}

// --- Dates CRUD ---
async function dbGetDates() {
    if (isDemoMode || !supabase) return null;
    const { data, error } = await supabase
        .from('dates')
        .select('*')
        .order('date', { ascending: true });
    if (error) throw error;
    return data;
}

async function dbAddDate(datePlan) {
    if (isDemoMode || !supabase) throw new Error("Demo Mode");
    const { data, error } = await supabase
        .from('dates')
        .insert([datePlan])
        .select();
    if (error) throw error;
    return data[0];
}

async function dbUpdateDate(id, datePlan) {
    if (isDemoMode || !supabase) throw new Error("Demo Mode");
    const { data, error } = await supabase
        .from('dates')
        .update(datePlan)
        .eq('id', id)
        .select();
    if (error) throw error;
    return data[0];
}

async function dbDeleteDate(id) {
    if (isDemoMode || !supabase) throw new Error("Demo Mode");
    const { error } = await supabase
        .from('dates')
        .delete()
        .eq('id', id);
    if (error) throw error;
}

// --- Songs CRUD ---
async function dbGetSongs() {
    if (isDemoMode || !supabase) return null;
    const { data, error } = await supabase
        .from('songs')
        .select('*')
        .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
}

async function dbAddSong(song) {
    if (isDemoMode || !supabase) throw new Error("Demo Mode");
    const { data, error } = await supabase
        .from('songs')
        .insert([song])
        .select();
    if (error) throw error;
    return data[0];
}

async function dbUpdateSong(id, song) {
    if (isDemoMode || !supabase) throw new Error("Demo Mode");
    const { data, error } = await supabase
        .from('songs')
        .update(song)
        .eq('id', id)
        .select();
    if (error) throw error;
    return data[0];
}

async function dbDeleteSong(id, audioUrl) {
    if (isDemoMode || !supabase) throw new Error("Demo Mode");
    const { error } = await supabase
        .from('songs')
        .delete()
        .eq('id', id);
    if (error) throw error;

    if (audioUrl) {
        await deleteFileFromUrl('songs', audioUrl);
    }
}

// Run client configuration init
initSupabase();
