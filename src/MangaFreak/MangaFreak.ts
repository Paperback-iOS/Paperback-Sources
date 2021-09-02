import {
    PagedResults,
    Source,
    Manga,
    Chapter,
    ChapterDetails,
    HomeSection,
    SearchRequest,
    SourceInfo,
    LanguageCode,
    TagType,
    MangaUpdates,
} from 'paperback-extensions-common'
import { parseChapterDetails, parseChapters, parseHomeSections, parseLatestRelease, parseMangaDetails, parseSearchRequest } from './MangaFreakParser'

const MANGAFREAK_DOMAIN = "https://w12.mangafreak.net"

export const MangaFreakInfo: SourceInfo = {
    author: 'sequal32',
    description: 'Extension that pulls manga from MangaFreak',
    icon: 'icon.png',
    name: 'MangaFreak',
    version: '1.1.0',
    authorWebsite: 'https://github.com/sequal32',
    websiteBaseURL: MANGAFREAK_DOMAIN,
    hentaiSource: false,
    language: LanguageCode.ENGLISH,
    sourceTags: [
        {
            text: "Notifications",
            type: TagType.GREEN
        }
    ],
}

export class MangaFreak extends Source {
    async doRequest(url: string): Promise<CheerioStatic> {
        const request = createRequestObject({
            url: url,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        return this.cheerio.load(response.data)
    }

    async getMangaDetails(mangaId: string): Promise<Manga> {
        const $ = await this.doRequest(`${MANGAFREAK_DOMAIN}/Manga/${mangaId}`)
        return parseMangaDetails(mangaId, $)
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const $ = await this.doRequest(`${MANGAFREAK_DOMAIN}/Manga/${mangaId}`)
        return parseChapters(mangaId, $)
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const $ = await this.doRequest(`${MANGAFREAK_DOMAIN}/Read1_${mangaId}_${chapterId}`)
        return parseChapterDetails(mangaId, chapterId, $)
    }

    async searchRequest(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const $ = await this.doRequest(`${MANGAFREAK_DOMAIN}/Search/${encodeURI(query.title!)}`)
        return parseSearchRequest($)
    }

    getMangaShareUrl(mangaId: string): string {
        return `${MANGAFREAK_DOMAIN}/Manga/${mangaId}`
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        parseHomeSections(sectionCallback, this.doRequest(MANGAFREAK_DOMAIN))
    }

    async filterUpdatedManga(mangaUpdatesFoundCallback: (updates: MangaUpdates) => void, time: Date, ids: string[]): Promise<void> {
        let isPastDate = false

        for (let page = 1; page <= 10; page++) {
            const $ = await this.doRequest(`${MANGAFREAK_DOMAIN}/Latest_Releases/${page}`)

            const updated_ids = parseLatestRelease($)
                .filter(data => {
                    if (data.updatedDate < time) {
                        isPastDate = true
                        return false
                    }
                    return ids.includes(data.id)
                })
                .map(data => data.id)

            mangaUpdatesFoundCallback(createMangaUpdates({ ids: updated_ids }))

            // Scanned enough pages
            if (isPastDate) {
                break
            }
        }
    }
}