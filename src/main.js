import { Actor } from 'apify';
import { PuppeteerCrawler } from 'crawlee';
import crypto from 'crypto';

await Actor.init();

// Getting user input
const input = await Actor.getInput();

const platforms = (input && input.platforms) || ['github', 'devto', 'reddit', 'hackernews'];
const keywords = (input && input.keywords) || ['startup', 'founder', 'developer'];
const maxLeads = (input && input.maxLeads) || 500;
const leadType = (input && input.leadType) || 'tech'; // 'tech', 'business', 'general'
const locations = (input && input.locations) || []; // Filter by locations
const excludeLocations = (input && input.excludeLocations) || []; // Exclude locations

console.log(`🚀 Starting Lead Generation`);
console.log(`📊 Platforms: ${platforms.join(', ')}`);
console.log(`🔍 Keywords: ${keywords.join(', ')}`);
console.log(`🎯 Target: ${maxLeads} leads`);
console.log(`📝 Lead Type: ${leadType}`);
if (locations.length > 0) {
    console.log(`📍 Location Filter: ${locations.join(', ')}`);
}
if (excludeLocations.length > 0) {
    console.log(`🚫 Exclude Locations: ${excludeLocations.join(', ')}`);
}

// Build starting URLs
const startUrls = [];

for (const platform of platforms) {
    for (const keyword of keywords) {
        if (platform === 'github') {
            startUrls.push({
                url: `https://api.github.com/search/users?q=${encodeURIComponent(keyword)}${locations.length > 0 ? '+location:' + locations.map(loc => encodeURIComponent(loc)).join('+') : ''}&per_page=100`,
                userData: { platform: 'github', keyword, type: 'users' },
            });
        } else if (platform === 'reddit') {
            startUrls.push({
                url: `https://www.reddit.com/search.json?q=${encodeURIComponent(keyword)}&sort=top&limit=100&type=link`,
                userData: { platform: 'reddit', keyword },
            });
        } else if (platform === 'devto') {
            startUrls.push({
                url: `https://dev.to/search?q=${encodeURIComponent(keyword)}`,
                userData: { platform: 'devto', keyword },
            });
        } else if (platform === 'hackernews') {
            startUrls.push({
                url: `https://hn.algolia.com/api/v1/search_by_date?tags=ask_hn&query=${encodeURIComponent(keyword)}&hitsPerPage=50`,
                userData: { platform: 'hackernews', keyword },
            });
        } else if (platform === 'producthunt') {
            startUrls.push({
                url: `https://www.producthunt.com/search?q=${encodeURIComponent(keyword)}`,
                userData: { platform: 'producthunt', keyword },
            });
        }
        console.log(`  ✅ Added URL for ${platform}`);
    }
}

let leadCount = 0;
const seenLeads = new Set();

const crawler = new PuppeteerCrawler({
    proxyConfiguration: await Actor.createProxyConfiguration({
        groups: ['RESIDENTIAL'],
    }),
    async requestHandler({ request, page, log }) {
        await page.setExtraHTTPHeaders({
            'Accept': 'application/json, text/html',
            'Accept-Language': 'en-US,en;q=0.9',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        });

        if (leadCount >= maxLeads) {
            log.info('Max leads reached, stopping...');
            return;
        }

        const { platform, keyword } = request.userData;
        log.info(`Scraping ${platform} for "${keyword}"`);

        let leads = [];

        try {
            if (platform === 'github') {
                leads = await scrapeGitHubUsers(page, log);
            } else if (platform === 'reddit') {
                leads = await scrapeRedditLeads(page, log);
            } else if (platform === 'devto') {
                leads = await scrapeDevToLeads(page, log);
            } else if (platform === 'hackernews') {
                leads = await scrapeHackerNewsLeads(page, log);
            } else if (platform === 'producthunt') {
                leads = await scrapeProductHuntLeads(page, log);
            }

            log.info(`Found ${leads.length} potential leads from ${platform}`);

            // Deduplicate leads
            leads = leads.filter(lead => {
                const identifier = lead.email || lead.profile_url || lead.username;
                if (!identifier || seenLeads.has(identifier)) return false;
                seenLeads.add(identifier);
                return true;
            });

            // Filter by location
            if (locations.length > 0 || excludeLocations.length > 0) {
                leads = leads.filter(lead => {
                    const leadLocation = (lead.location || '').toLowerCase();
                    
                    // If location filter is set, lead must match at least one location
                    if (locations.length > 0) {
                        const matchesLocation = locations.some(loc => 
                            leadLocation.includes(loc.toLowerCase())
                        );
                        if (!matchesLocation) return false;
                    }
                    
                    // If exclude locations is set, lead must not match any excluded location
                    if (excludeLocations.length > 0) {
                        const matchesExcluded = excludeLocations.some(loc => 
                            leadLocation.includes(loc.toLowerCase())
                        );
                        if (matchesExcluded) return false;
                    }
                    
                    return true;
                });
                
                log.info(`After location filtering: ${leads.length} leads`);
            }

            // Save leads to dataset
            for (const lead of leads) {
                if (leadCount >= maxLeads) break;

                await Actor.pushData({
                    ...lead,
                    keyword,
                    scraped_at: new Date().toISOString(),
                });

                leadCount++;
            }

            log.info(`Collected ${leads.length} new leads. Total: ${leadCount}/${maxLeads}`);

        } catch (error) {
            log.error(`Error scraping ${platform}:`, error);
        }
    },
    maxRequestsPerCrawl: startUrls.length * 3,
    maxConcurrency: 2,
    launchContext: {
        launchOptions: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
            ],
        },
    },
});

await crawler.run(startUrls);

console.log(`\n✅ Lead generation completed! Total leads: ${leadCount}`);

await Actor.exit();

// ==================== SCRAPING FUNCTIONS ====================

async function scrapeGitHubUsers(page, log) {
    log.info('📥 Fetching GitHub users...');

    const jsonData = await page.evaluate(() => {
        const preTag = document.querySelector('pre');
        if (preTag) return preTag.textContent;
        return document.body.textContent;
    });

    try {
        const data = JSON.parse(jsonData);
        const leads = [];

        if (data.items && Array.isArray(data.items)) {
            log.info(`✅ Found ${data.items.length} GitHub users`);

            for (const user of data.items) {
                const lead = {
                    lead_id: `github_${user.id}`,
                    source: 'github',
                    name: user.login,
                    username: user.login,
                    profile_url: user.html_url,
                    avatar_url: user.avatar_url,
                    bio: user.bio || '',
                    company: user.company || '',
                    location: user.location || '',
                    email: user.email || '',
                    website: user.blog || '',
                    social_links: {
                        github: user.html_url,
                        twitter: user.twitter_username ? `https://twitter.com/${user.twitter_username}` : '',
                    },
                    metadata: {
                        followers: user.followers || 0,
                        following: user.following || 0,
                        public_repos: user.public_repos || 0,
                        type: user.type,
                        created_at: user.created_at,
                    },
                    lead_score: calculateLeadScore(user),
                };

                leads.push(lead);
            }
        }

        return leads;
    } catch (error) {
        log.error('❌ Error parsing GitHub data:', error.message);
        return [];
    }
}

async function scrapeRedditLeads(page, log) {
    log.info('📥 Fetching Reddit data...');

    const jsonData = await page.evaluate(() => {
        const preTag = document.querySelector('pre');
        if (preTag) return preTag.textContent;
        return document.body.textContent;
    });

    try {
        const data = JSON.parse(jsonData);
        const leads = [];

        if (data.data && data.data.children) {
            const posts = data.data.children;
            log.info(`✅ Found ${posts.length} Reddit posts`);

            posts.forEach((item) => {
                const post = item.data;
                if (!post.author || post.author === '[deleted]') return;

                const lead = {
                    lead_id: `reddit_${post.author}_${post.id}`,
                    source: 'reddit',
                    name: post.author,
                    username: post.author,
                    profile_url: `https://reddit.com/user/${post.author}`,
                    bio: '',
                    company: '',
                    location: '',
                    email: '',
                    website: '',
                    avatar_url: '',
                    social_links: {
                        reddit: `https://reddit.com/user/${post.author}`,
                    },
                    metadata: {
                        post_title: post.title,
                        post_url: `https://reddit.com${post.permalink}`,
                        subreddit: post.subreddit,
                        karma: post.score,
                        comments: post.num_comments,
                        created: new Date(post.created_utc * 1000).toISOString(),
                    },
                    lead_score: post.score > 100 ? 8 : 5,
                };

                leads.push(lead);
            });
        }

        return leads;
    } catch (error) {
        log.error('❌ Error parsing Reddit data:', error.message);
        return [];
    }
}

async function scrapeDevToLeads(page, log) {
    log.info('📥 Fetching Dev.to leads...');

    try {
        await page.waitForSelector('article, .crayons-story', { timeout: 10000 });

        const leads = await page.evaluate(() => {
            const leads = [];
            const articles = document.querySelectorAll('article.crayons-story');

            articles.forEach((article, index) => {
                if (index >= 30) return;

                try {
                    const authorEl = article.querySelector('a[href^="/"]');
                    const titleEl = article.querySelector('h2 a, h3 a');
                    const tagsEls = article.querySelectorAll('.crayons-tag');

                    const authorName = authorEl?.textContent?.trim() || '';
                    const authorUrl = authorEl?.href || '';
                    const username = authorUrl.split('/').pop();

                    if (!username) return;

                    const tags = Array.from(tagsEls).map(t => t.textContent.trim().replace('#', ''));

                    leads.push({
                        lead_id: `devto_${username}_${index}`,
                        source: 'devto',
                        name: authorName,
                        username: username,
                        profile_url: authorUrl.startsWith('http') ? authorUrl : `https://dev.to${authorUrl}`,
                        bio: '',
                        company: '',
                        location: '',
                        email: '',
                        website: '',
                        avatar_url: '',
                        social_links: {
                            devto: authorUrl.startsWith('http') ? authorUrl : `https://dev.to${authorUrl}`,
                        },
                        metadata: {
                            article_title: titleEl?.textContent?.trim() || '',
                            tags: tags,
                        },
                        lead_score: tags.length > 3 ? 7 : 5,
                    });
                } catch (err) {
                    console.error('Error parsing Dev.to lead:', err);
                }
            });

            return leads;
        });

        log.info(`✅ Found ${leads.length} Dev.to leads`);
        return leads;
    } catch (error) {
        log.error('❌ Error scraping Dev.to:', error.message);
        return [];
    }
}

async function scrapeHackerNewsLeads(page, log) {
    log.info('📥 Fetching HackerNews leads...');

    const jsonData = await page.evaluate(() => {
        const preTag = document.querySelector('pre');
        if (preTag) return preTag.textContent;
        return document.body.textContent;
    });

    try {
        const data = JSON.parse(jsonData);
        const leads = [];

        if (data.hits && Array.isArray(data.hits)) {
            log.info(`✅ Found ${data.hits.length} HackerNews posts`);

            data.hits.forEach((hit) => {
                if (!hit.author) return;

                const lead = {
                    lead_id: `hn_${hit.author}_${hit.objectID}`,
                    source: 'hackernews',
                    name: hit.author,
                    username: hit.author,
                    profile_url: `https://news.ycombinator.com/user?id=${hit.author}`,
                    bio: '',
                    company: '',
                    location: '',
                    email: '',
                    website: '',
                    avatar_url: '',
                    social_links: {
                        hackernews: `https://news.ycombinator.com/user?id=${hit.author}`,
                    },
                    metadata: {
                        post_title: hit.title || hit.story_title,
                        post_url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
                        points: hit.points || 0,
                        comments: hit.num_comments || 0,
                        created: hit.created_at,
                    },
                    lead_score: (hit.points || 0) > 50 ? 8 : 5,
                };

                leads.push(lead);
            });
        }

        return leads;
    } catch (error) {
        log.error('❌ Error parsing HackerNews data:', error.message);
        return [];
    }
}

async function scrapeProductHuntLeads(page, log) {
    log.info('📥 Fetching Product Hunt leads...');

    try {
        await page.waitForSelector('[class*="post"], [data-test="post"]', { timeout: 10000 });

        const leads = await page.evaluate(() => {
            const leads = [];
            const posts = document.querySelectorAll('[class*="post"], [data-test="post"]');

            posts.forEach((post, index) => {
                if (index >= 20) return;

                try {
                    const makerEl = post.querySelector('[class*="maker"], a[href*="/users/"]');
                    const titleEl = post.querySelector('h3, [class*="title"]');

                    const makerName = makerEl?.textContent?.trim() || '';
                    const makerUrl = makerEl?.href || '';

                    if (!makerUrl) return;

                    leads.push({
                        lead_id: `ph_${index}_${Date.now()}`,
                        source: 'producthunt',
                        name: makerName,
                        username: makerName,
                        profile_url: makerUrl,
                        bio: '',
                        company: '',
                        location: '',
                        email: '',
                        website: '',
                        avatar_url: '',
                        social_links: {
                            producthunt: makerUrl,
                        },
                        metadata: {
                            product_title: titleEl?.textContent?.trim() || '',
                            platform: 'producthunt',
                        },
                        lead_score: 7,
                    });
                } catch (err) {
                    console.error('Error parsing Product Hunt lead:', err);
                }
            });

            return leads;
        });

        log.info(`✅ Found ${leads.length} Product Hunt leads`);
        return leads;
    } catch (error) {
        log.error('❌ Error scraping Product Hunt:', error.message);
        return [];
    }
}

// ==================== UTILITY FUNCTIONS ====================

function calculateLeadScore(user) {
    let score = 5; // Base score

    // GitHub specific scoring
    if (user.followers) {
        if (user.followers > 1000) score += 3;
        else if (user.followers > 100) score += 2;
        else if (user.followers > 10) score += 1;
    }

    if (user.public_repos) {
        if (user.public_repos > 50) score += 2;
        else if (user.public_repos > 10) score += 1;
    }

    if (user.company) score += 1;
    if (user.blog) score += 1;
    if (user.email) score += 2;
    if (user.location) score += 1;

    return Math.min(score, 10);
}