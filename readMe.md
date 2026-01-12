# B2B Leads Generator 🎯

Generate high-quality B2B leads from multiple platforms including GitHub, Dev.to, Reddit, HackerNews, and Product Hunt.

## Features ✨

- **Multi-Platform Scraping**: GitHub, Dev.to, Reddit, HackerNews, Product Hunt
- **Smart Lead Scoring**: Automatic scoring based on engagement and profile quality
- **Deduplication**: Automatically removes duplicate leads
- **Rich Data**: Collects names, emails (when public), social profiles, and more
- **Customizable**: Filter by keywords and target specific lead types

## Platforms Supported 🌐

### 1. GitHub
- Developer profiles
- Public emails (when available)
- Company information
- Location data
- Social links

### 2. Dev.to
- Developer profiles
- Article authors
- Tags and interests

### 3. Reddit
- Post authors from relevant subreddits
- Karma scores
- Community engagement

### 4. HackerNews
- Active community members
- Engagement metrics
- Post history

### 5. Product Hunt (Coming Soon)
- Product makers
- Founders
- Early adopters

## Input Configuration 📝

```json
{
  "platforms": ["github", "devto", "reddit", "hackernews"],
  "keywords": ["startup", "founder", "machine learning", "saas"],
  "maxLeads": 500,
  "leadType": "tech"
}
```

### Parameters

- **platforms** (array): Platforms to scrape
- **keywords** (array): Keywords to search for
- **maxLeads** (number): Maximum leads to collect (default: 500)
- **leadType** (string): Type of leads - "tech", "business", or "general"

## Output Format 📊

Each lead contains:

```json
{
  "lead_id": "github_12345",
  "source": "github",
  "name": "John Doe",
  "username": "johndoe",
  "profile_url": "https://github.com/johndoe",
  "email": "john@example.com",
  "company": "Tech Startup Inc",
  "location": "San Francisco, CA",
  "bio": "Full-stack developer passionate about AI",
  "website": "https://johndoe.com",
  "social_links": {
    "github": "https://github.com/johndoe",
    "twitter": "https://twitter.com/johndoe"
  },
  "metadata": {
    "followers": 1234,
    "public_repos": 56
  },
  "lead_score": 8,
  "keyword": "machine learning",
  "scraped_at": "2025-01-12T10:30:00.000Z"
}
```

## Lead Scoring 📈

Leads are automatically scored from 1-10 based on:

- **Profile completeness** (email, location, bio, website)
- **Engagement metrics** (followers, repos, karma, points)
- **Activity level** (recent posts, contributions)
- **Professional indicators** (company affiliation, public work)

## Use Cases 💡

- **Developer Outreach**: Find developers for your product
- **Recruiting**: Source technical talent
- **Partnership Building**: Connect with founders and makers
- **Market Research**: Understand your target audience
- **Community Building**: Grow your developer community

## Legal & Ethical Use ⚖️

This actor only collects **publicly available information** from platforms' public APIs and pages. 

**Important Guidelines:**
- ✅ Use for legitimate business purposes
- ✅ Respect platform rate limits
- ✅ Only contact leads with permission
- ❌ Don't spam or harass
- ❌ Don't violate platform Terms of Service
- ❌ Don't sell or misuse personal data

## Running Locally 🏃

```bash
# Install dependencies
npm install

# Run the actor
npm start
```

## Deploying to Apify 🚀

```bash
# Login to Apify
apify login

# Deploy
apify push
```

## Tips for Best Results 💪

1. **Use Specific Keywords**: Instead of "developer", try "react developer" or "machine learning engineer"
2. **Combine Platforms**: Different platforms attract different audiences
3. **Quality Over Quantity**: Start with lower maxLeads to get higher quality
4. **Regular Updates**: Run periodically to find new leads
5. **Enrich Data**: Use additional tools to find email addresses for leads without public emails

## Limitations ⚠️

- Email addresses are only collected when publicly available
- Rate limits may affect the number of leads collected
- Some platforms require proxies for reliable scraping
- LinkedIn and Facebook are NOT supported due to their strict anti-scraping policies

## Support 🤝

For issues or questions, please open an issue on GitHub or contact support.

## License 📄

ISC License - Free to use and modify.