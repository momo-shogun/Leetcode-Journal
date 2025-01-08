import { supabase } from '@/lib/supabaseClient';
import axios from 'axios';
import { NextRequest, NextResponse } from 'next/server';

// Fetch LeetCode stats
const fetchLeetCodeStats = async (username: string) => {
    const query = `
    query getUserProfile($username: String!) {
      matchedUser(username: $username) {
        username
        profile {
          realName
          ranking
        }
        submitStats {
          acSubmissionNum {
            difficulty
            count
          }
        }
      }
    }
  `;
    try {
        const variables = { username };
        const { data } = await axios.post('https://leetcode.com/graphql', {
            query,
            variables,
        });
        return data.data.matchedUser;
    } catch (error) {
        console.error('Error fetching LeetCode data:', error);
        return null;
    }
};

// Store transformed user stats in Supabase
const storeUserStats = async (id: string, stats: any) => {
    const entry = {
        id: String(id),
        ranking: stats.profile.ranking,
        solved_easy: stats.submitStats.acSubmissionNum.find((item: any) => item.difficulty === 'Easy')?.count || "0",
        solved_medium: stats.submitStats.acSubmissionNum.find((item: any) => item.difficulty === 'Medium')?.count || "0",
        solved_hard: stats.submitStats.acSubmissionNum.find((item: any) => item.difficulty === 'Hard')?.count || "0",
    };
    const { data, error } = await supabase.from('user_info').upsert([entry]);

    if (error) {
        console.error('Error storing data in Supabase:', error);
    }

    return data;
};

// Transform LeetCode data into a UI-friendly structure
const transformLeetCodeData = (stats: any) => {
    return {
        username: stats.username,
        profile: {
            realName: stats.profile.realName || "Unknown",
            ranking: stats.profile.ranking?.toString() || "0",
        },
        submitStats: {
            acSubmissionNum: stats.submitStats.acSubmissionNum.map((item: any) => ({
                difficulty: item.difficulty,
                count: item.count?.toString() || "0",
            })),
        },
    };
};

// API POST Handler
export async function POST(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const username = searchParams.get('username');
    const id = searchParams.get('id');

    if (!username || !id) {
        return NextResponse.json({ error: "Username and id are required" }, { status: 400 });
    }

    const stats = await fetchLeetCodeStats(username);

    if (!stats) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const transformedStats = transformLeetCodeData(stats);

    await storeUserStats(id, transformedStats);

    return NextResponse.json({ message: "Success", stats: transformedStats });
}
