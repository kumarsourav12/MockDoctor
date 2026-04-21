# MockDoctor launch plan

This is a focused launch plan, not a spam list.

The goal is to get MockDoctor in front of people who already deal with:

- ReadyAPI virtual services
- API testing
- QA automation
- contract drift
- CI failures caused by stale mocks

## Positioning sentence

Use this sentence everywhere first:

> MockDoctor compares ReadyAPI REST virtual services with OpenAPI or JSON contracts and catches mock drift before false-green tests reach CI.

That line is short enough for GitHub, LinkedIn, and opening paragraphs.

## Suggested launch order

1. publish the GitHub release
2. update the repo description and website field
3. post one short launch note on LinkedIn
4. post the article on DEV or Hashnode
5. share the article into one QA-focused Reddit community
6. share a shorter ReadyAPI-specific version in SmartBear Community

Do not do all of them at once with the same copy. Spread them across a few days.

## Best-fit channels

### 1. LinkedIn

Best for:

- people who already know you
- recruiters and hiring managers checking your profile
- broader dev/QA visibility

Use:

- one screenshot of the homepage or HTML drift report
- one concrete sentence about stale mocks causing false-green tests

Draft:

> Built and open-sourced MockDoctor.  
>  
> It compares ReadyAPI REST virtual services with OpenAPI or JSON contracts and catches mock drift before false-green tests reach CI.  
>  
> I built it around a problem I kept seeing in QA/API workflows: the contract changes, the mock does not, and the tests still pass against the wrong response.  
>  
> Repo: https://github.com/kumarsourav12/MockDoctor  
> Demo site: https://kumarsourav12.github.io/MockDoctor/

### 2. DEV Community

Current relevant tags with active traffic:

- `#testing`
- `#api`
- `#github`

Links:

- https://dev.to/t/Testing/
- https://dev.to/tag/api

Best for:

- the longer article
- reaching people who install tools from technical writeups

Post type:

- article, not launch-only link drop

### 3. Hashnode

Current relevant tags:

- `#software-testing`
- `#apis`

Links:

- https://hashnode.com/tag/software-testing
- https://hashnode.com/tag/apis

Best for:

- the same article adapted slightly for a more engineering-blog audience

### 4. Reddit: r/QualityAssurance

Why it fits:

- current API-testing discussions are active there, including recent threads about API testing depth and automation layers

Examples:

- https://www.reddit.com/r/QualityAssurance/comments/1slo4ro/how_much_automation_you_do_on_api_level/
- https://www.reddit.com/r/QualityAssurance/comments/1kwuio8/api_testing/

Post style:

- short, practical, not promotional
- frame it as a tool built for one specific pain

Draft:

> Built a small open-source tool for one QA pain point: ReadyAPI mock drift.  
>  
> MockDoctor compares ReadyAPI REST virtual services with OpenAPI or JSON contracts and reports where the drift starts, like missing operations, missing response codes, content-type mismatches, invalid JSON, or schema mismatches.  
>  
> The main use case is catching stale mocks before CI gives a false-green result.  
>  
> Repo: https://github.com/kumarsourav12/MockDoctor  
> Demo: https://kumarsourav12.github.io/MockDoctor/  
>  
> Curious whether other people here are checking virtual-service files this way or handling it differently.

### 5. Reddit: r/softwaretesting

Why it fits:

- there are ReadyAPI and API-testing threads there, but the audience is broader and more skeptical

Example:

- https://www.reddit.com/r/softwaretesting/comments/1je6q1f/has_anyone_integrated_readyapi_with_jenkins_to/

Post style:

- more technical
- emphasize CI and contract drift, not branding

### 6. SmartBear Community

Why it fits:

- direct ReadyAPI audience
- this is where users already discuss virtualization and CI pain

Relevant entry points:

- https://community.smartbear.com/discussions/readyapi-questions/ready-api-virtualization/233358
- https://support.smartbear.com/readyapi/docs/virtualization/intro/index.html

Post style:

- keep it respectful and specific
- frame it as a companion tool for committed ReadyAPI REST virtual-service files
- avoid sounding like an ad

Draft:

> I built an open-source CLI called MockDoctor for teams that keep ReadyAPI REST virtual-service files in git.  
>  
> It compares those files with an OpenAPI spec or a JSON contract and flags drift like missing operations, missing response codes, content-type mismatches, invalid JSON, and schema mismatches.  
>  
> The main goal is catching stale virtual services before they create false-green test results in CI.  
>  
> Repo: https://github.com/kumarsourav12/MockDoctor  
> Demo: https://kumarsourav12.github.io/MockDoctor/  
>  
> If anyone here is maintaining ReadyAPI virtual services in source control, I’d love to know whether this matches your workflow.

## What not to do

- Do not post the same copy everywhere.
- Do not lead with “I built a tool” and stop there.
- Do not call it “AI-powered” because that invites the wrong comparison.
- Do not target broad generalist dev forums first. The narrow ReadyAPI/API-testing angle is the strength.

## Recommended assets to attach

Use one or two of these, not all of them in every post:

- homepage screenshot
- HTML drift report screenshot
- terminal output showing one real schema drift
- short GIF scrolling the demo page
