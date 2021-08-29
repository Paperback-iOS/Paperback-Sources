import {
  Source,
  Manga,
  Chapter,
  ChapterDetails,
  HomeSection,
  SearchRequest,
  TagSection,
  PagedResults,
  SourceInfo,
  MangaUpdates,
  TagType,
  RequestHeaders
} from "paperback-extensions-common"
import { parseChapterDetails, parseChapters, parseHomeSections, parseMangaDetails, parseSearch, parseTags, parseUpdatedManga, parseViewMore, searchMetadata } from "./Manga1000Parsing"
import { decodeHTML } from "entities" 

export const decodeHTMLEntity = (str: string): string => {
    return decodeHTML(str)
}

export const MS_DOMAIN = 'https://manga1000.com'
const headers = { "content-type": "application/x-www-form-urlencoded" }
const method = 'GET'

export const Manga1000Info: SourceInfo = {
  version: '0.0.1',
  name: 'Manga1000',
  icon: 'Logo.png',
  author: 'Swaggy P',
  authorWebsite: 'https://github.com/swaggy-p-jp',
  description: 'Extension that pulls manga from Manga1000',
  hentaiSource: false,
  websiteBaseURL: MS_DOMAIN,
  sourceTags: [
    {
      text: "Notifications",
      type: TagType.GREEN
    },
    {
      text: "Japanese",
      type: TagType.GREY
    }
  ]
}

export class Manga1000 extends Source {
  getMangaShareUrl(mangaId: string): string | null { 
    const mangaIdUrl =  encodeURI(decodeHTMLEntity(mangaId))
    return `${MS_DOMAIN}/${mangaIdUrl}/`
  }

  async getMangaDetails(mangaId: string): Promise<Manga> {
    const formattedUrl = encodeURI(`${MS_DOMAIN}/${mangaId}`)
    const request = createRequestObject({
      url: formattedUrl,
      method
    })

    const response = await this.requestManager.schedule(request, 1)
    let $ = this.cheerio.load(response.data)
    return parseMangaDetails($, mangaId)
  }

  async getChapters(mangaId: string): Promise<Chapter[]> {
    const formattedUrl = encodeURI(`${MS_DOMAIN}/${mangaId}`)
    const request = createRequestObject({
      url: formattedUrl,
      method,
      headers
    })

    const response = await this.requestManager.schedule(request, 1)
    const $ = this.cheerio.load(response.data)
    return parseChapters($, mangaId)
  }

  async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
    const url = encodeURI(chapterId)
    const request = createRequestObject({
      url: url,
      headers,
      method,
    })

    const response = await this.requestManager.schedule(request, 1)
    const $ = this.cheerio.load(response.data)
    return parseChapterDetails($, mangaId, chapterId);
  }

  async searchRequest(query: SearchRequest, _metadata: any): Promise<PagedResults> {
    
    let title = query.title;
    if (title !== undefined){
      title = encodeURI(title)
    }

    let request

    if (_metadata?.page) {
      request = createRequestObject({
        url: `${MS_DOMAIN}/page/${_metadata.page}/?s=${title}`,
        method
      })
    } else {
      request = createRequestObject({
        url: `${MS_DOMAIN}/?s=${title}`,
        method
      })
    }
    

    const response = await this.requestManager.schedule(request, 1)
    const $ = this.cheerio.load(response.data)
    return parseSearch($, _metadata)
  }


  // will implement later ..... maybe

  // async getTags(): Promise<TagSection[] | null> {
  //   const request = createRequestObject({
  //     url: `${MS_DOMAIN}/search/`,
  //     method,
  //     headers,
  //   })

  //   const response = await this.requestManager.schedule(request, 1)
  //   return parseTags(response.data);
  // }

  async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
    const request = createRequestObject({
      url: `${MS_DOMAIN}`,
      method,
    })

    const response = await this.requestManager.schedule(request, 1)
    const $ = this.cheerio.load(response.data)
    parseHomeSections($, sectionCallback);
  }

  async getViewMoreItems(homepageSectionId: string, _metadata: any): Promise<PagedResults | null> {
    let request;

    if (_metadata?.page) {
      request = createRequestObject({
        url: `${MS_DOMAIN}/page/${_metadata.page}/`,
        method
      })
    } else {
      request = createRequestObject({
        url: `${MS_DOMAIN}/`,
        method
      })
    }

    const response = await this.requestManager.schedule(request, 1)
    const $ = this.cheerio.load(response.data)
    return parseViewMore($, homepageSectionId, _metadata);
  }

  globalRequestHeaders(): RequestHeaders {
    return {
      referer: MS_DOMAIN 
    }
  }
}
