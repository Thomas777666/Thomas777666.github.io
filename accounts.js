import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://evkvhufdgdzwydqgbqlw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_6PU1v-7-HZiUMBm-e3hb4Q_86_8iSrc";
const EMAIL_DOMAIN = "sparky.example.com";

const PLAN_PREFIX = {
    basic: "BASIC",
    plus: "PLUS",
    pro: "PRO"
};

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function normalizeLogin(value) {
    return String(value || "").trim().toLowerCase();
}

function loginToEmail(login) {
    return `${normalizeLogin(login)}@${EMAIL_DOMAIN}`;
}

function getPlanPrefix(plan) {
    return PLAN_PREFIX[plan] || "BASIC";
}

function buildFallbackKey(login, plan) {
    const safeLogin = normalizeLogin(login).replace(/[^a-z0-9]/g, "").toUpperCase() || "USER";
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `SPARK-${getPlanPrefix(plan)}-${safeLogin.slice(0, 6)}-${suffix}`;
}

async function fetchProfileByUserId(userId) {
    const { data, error } = await supabase
        .from("profiles")
        .select("id, username, plan, key, created_at")
        .eq("id", userId)
        .single();

    if (error) throw error;
    return data;
}

async function registerAccount(login, password) {
    const username = normalizeLogin(login);
    const email = loginToEmail(username);

    if (!username || !password) {
        throw new Error("Login and password are required");
    }

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                username
            }
        }
    });

    if (error) throw error;

    if (!data.user) {
        throw new Error("Account was not created");
    }

    let profile = null;
    try {
        profile = await fetchProfileByUserId(data.user.id);
    } catch (profileError) {
        profile = {
            id: data.user.id,
            username,
            plan: "basic",
            key: buildFallbackKey(username, "basic")
        };
    }

    return {
        authUser: data.user,
        session: data.session,
        profile
    };
}

async function authenticate(login, password) {
    const username = normalizeLogin(login);
    const email = loginToEmail(username);

    if (!username || !password) {
        throw new Error("Login and password are required");
    }

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) throw error;

    if (!data.user) {
        throw new Error("Login failed");
    }

    const profile = await fetchProfileByUserId(data.user.id);

    return {
        authUser: data.user,
        session: data.session,
        profile
    };
}

async function getCurrentProfile() {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session || null;

    if (!session?.user?.id) return null;

    try {
        return await fetchProfileByUserId(session.user.id);
    } catch (error) {
        return null;
    }
}

async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

window.SparkyAccounts = {
    supabase,
    normalizeLogin,
    loginToEmail,
    buildFallbackKey,
    registerAccount,
    authenticate,
    getCurrentProfile,
    signOut
};

