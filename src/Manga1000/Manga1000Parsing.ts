import { Chapter, ChapterDetails, HomeSection, LanguageCode, Manga, MangaStatus, MangaTile, MangaUpdates, PagedResults, SearchRequest, TagSection } from "paperback-extensions-common"
import { decodeHTMLEntity } from "./Manga1000"


// this.decodeHTMLEntity($('div.description-summary')) //example

let MS_IMAGE_DOMAIN = 'https://picsum.photos/200'

export type RegexIdMatch = {
    [id: string]: RegExp
}
export const regex: RegexIdMatch = {
    'hot_update': /vm.HotUpdateJSON = (.*);/,
    'latest': /<article.*>([\s\S]*?)<\/article>/,
    'recommended': /vm.RecommendationJSON = (.*);/,
    'new_titles': /vm.NewSeriesJSON = (.*);/,
    'chapters': /vm.Chapters = (.*);/,
    'directory': /vm.FullDirectory = (.*);/,
    'directory_image_host': /<img ng-src=\"(.*)\//
}

export const parseMangaDetails = ($: CheerioStatic, mangaId: string): Manga => {
    const follows = Number($.root().html()?.match(/vm.NumSubs = (.*);/)?.[1])
    const titles = [mangaId.split(' ')[0]]
    const image = $(".wp-block-image").find("img")[0].attribs.src
    const status = MangaStatus.ONGOING // Manga1000 doesn't give us this info
    let author = $(".has-text-color").html()?.split(": ")[1].split("<br>")[0]
    if (author !== undefined) {
        author = decodeHTMLEntity(author)
    }
    let desc = $(".has-text-color").next().html() || undefined
    if (desc !== undefined){
        desc = decodeHTMLEntity(desc)
    }
    const tagSections: TagSection[] = [createTagSection({ id: '0', label: 'genres', tags: [] }),
    createTagSection({ id: '1', label: 'format', tags: [] })]
    const lastUpdate = undefined // not used in manga1000
    const listOfTags = $(".tags-links").find("a")
    const tempTags: string[] = []
    for (let i of listOfTags.toArray()){
        tempTags.push($(i).text())
    }
    tagSections[0].tags = tempTags.map((elem: string) => createTag({ id: elem, label: elem }))
    return createManga({
        id: mangaId,
        titles,
        image,
        rating: 0,
        status,
        author,
        tags: tagSections,
        desc,
        //hentai,
        hentai: false,
        follows,
        lastUpdate
    })
}

export const parseChapters = ($: CheerioStatic, mangaId: string): Chapter[] => {
     
    const chapters: Chapter[] = []

    const links = $("td").find("a")

    for (const href of links.toArray()){
        const id = decodeURI(href.attribs.href) //chapter link itself
        const tempChapNum = id.match(/【(.*?)\】/)?.[0].match(/\d+/)?.[0]
        let chapNum: number = 0;
        
        if( tempChapNum !== undefined ){
            chapNum = parseFloat(tempChapNum)
        }

        chapters.push(createChapter({
            id,
            mangaId,
            chapNum,
            langCode: LanguageCode.JAPANESE,
        }))
    }

    return chapters;
      
}

    

export const parseChapterDetails = ($: CheerioStatic, mangaId: string, chapterId: string): ChapterDetails => {
    const imgLinks = $(".wp-block-image").find("img")
    const pages: string[] = []
    for(const links of imgLinks.toArray()){
        const page = links.attribs["data-src"] ? links.attribs["data-src"] : links.attribs.src
        pages.push(page)
    }

    return createChapterDetails({
      id: chapterId,
      mangaId: mangaId,
      pages, longStrip: false
    })
}

export const parseUpdatedManga = ({ data }: any, time: Date, ids: string[]): MangaUpdates => {
    const returnObject: MangaUpdates = {
        'ids': []
    }
    const updateManga = JSON.parse(data.match(regex['latest'])?.[1])
    for (const elem of updateManga) {
        if (ids.includes(elem.IndexName) && time < new Date(elem.Date)) returnObject.ids.push(elem.IndexName)
    }
    return returnObject;
}

export const searchMetadata = (query: SearchRequest) => {
    let status = ""
    switch (query.status) {
        case 0: status = 'Completed'; break
        case 1: status = 'Ongoing'; break
        default: status = ''
    }

    const genre: string[] | undefined = query.includeGenre ?
        (query.includeDemographic ? query.includeGenre.concat(query.includeDemographic) : query.includeGenre) :
        query.includeDemographic
    const genreNo: string[] | undefined = query.excludeGenre ?
        (query.excludeDemographic ? query.excludeGenre.concat(query.excludeDemographic) : query.excludeGenre) :
        query.excludeDemographic

    return {
        'keyword': query.title?.toLowerCase(),
        'author': query.author?.toLowerCase() || query.artist?.toLowerCase() || '',
        'status': status?.toLowerCase() ?? '',
        'type': query.includeFormat?.map((x) => x?.toLowerCase() ?? ''),
        'genre': genre?.map((x) => x?.toLowerCase() ?? ''),
        'genreNo': genreNo?.map((x) => x?.toLowerCase() ?? '')
    }
}

export const parseSearch = ($: CheerioStatic, metadata: any): PagedResults => {
    let page: number = metadata?.page ?? 1

    const newReleases = $("article").find(".featured-thumb")

    const latest = []

    for(let releases of newReleases.toArray()){
        latest.push(releases)
    }

    const mangaTiles: MangaTile[] = []

    for (const elem of latest) {
        const urlId = $(elem).find("a")[0].attribs.href
        const mangaId = decodeURI(urlId).split(".com/")[1].slice(0, -1)
        const title = $(elem).find("img")[0].attribs.alt.split("(")[0].trim()
        const image = $(elem).find("img")[0].attribs.src
        let time = (new Date($(elem).find("img")[0].attribs.Date)).toDateString()
        time = time.slice(0, time.length - 5)
        time = time.slice(4, time.length)
        mangaTiles.push(createMangaTile({
            id: mangaId,
            image,
            title: createIconText({ text: title }),
            secondaryText: createIconText({ text: time, icon: 'clock.fill' })
        }))
    }

    let mData
    if ($(".page-numbers.current").next()[0]) {
        mData = {page: (page + 1)}
    } else {
        mData = undefined  // There are no more pages to continue on to, do not provide page metadata
    }

    // This source parses JSON and never requires additional pages
    return createPagedResults({
        results: mangaTiles,
        metadata: mData
    })
}

export const parseTags = (data: any): TagSection[] => {
    const tagSections: TagSection[] = [createTagSection({ id: '0', label: 'genres', tags: [] }),
        createTagSection({ id: '1', label: 'format', tags: [] })]
    const genres = JSON.parse(data.match(/"Genre"\s*: (.*)/)?.[1].replace(/'/g, "\""))
    const typesHTML = data.match(/"Type"\s*: (.*),/g)?.[1]
    const types = JSON.parse(typesHTML.match(/(\[.*\])/)?.[1].replace(/'/g, "\""))
    tagSections[0].tags = genres.map((e: any) => createTag({ id: e, label: e }))
    tagSections[1].tags = types.map((e: any) => createTag({ id: e, label: e }))
    return tagSections
}

export const parseHomeSections = ($: CheerioStatic, sectionCallback: (section: HomeSection) => void): void => {
    const latestSection = createHomeSection({ id: 'latest', title: 'LATEST UPDATES', view_more: true })


    const newReleases = $("article").find(".featured-thumb")

    const latest = []

    for(let releases of newReleases.toArray()){
        latest.push(releases)
    }

    const sections = [latestSection]

    for (const [i, section] of sections.entries()) {
        sectionCallback(section)
        const manga: MangaTile[] = []
        for (const elem of latest) {
            const urlId = $(elem).find("a")[0].attribs.href
            const mangaId = decodeURI(urlId).split(".com/")[1].slice(0, -1)
            const title = $(elem).find("img")[0].attribs.alt.split("(")[0].trim()
            const image = $(elem).find("img")[0].attribs.src
            let time = (new Date($(elem).find("img")[0].attribs.Date)).toDateString()
            time = time.slice(0, time.length - 5)
            time = time.slice(4, time.length)
            manga.push(createMangaTile({
                id: mangaId,
                image,
                title: createIconText({ text: title }),
                secondaryText: createIconText({ text: time, icon: 'clock.fill' })
            }))
        }
        section.items = manga
        sectionCallback(section)
    }
}

export const parseViewMore = ($: CheerioStatic, homepageSectionId: string, metadata: any): PagedResults | null => {
    let page: number = metadata?.page ?? 1

    const newReleases = $("article").find(".featured-thumb")

    const latest = []

    for(let releases of newReleases.toArray()){
        latest.push(releases)
    }

    const manga: MangaTile[] = []
    for (const elem of latest) {
        const urlId = $(elem).find("a")[0].attribs.href
        const mangaId = decodeURI(urlId).split(".com/")[1].slice(0, -1)
        const title = $(elem).find("img")[0].attribs.alt.split("(")[0].trim()
        const image = $(elem).find("img")[0].attribs.src
        let time = (new Date($(elem).find("img")[0].attribs.Date)).toDateString()
        time = time.slice(0, time.length - 5)
        time = time.slice(4, time.length)
        manga.push(createMangaTile({
            id: mangaId,
            image,
            title: createIconText({ text: title }),
            secondaryText: createIconText({ text: time, icon: 'clock.fill' })
        }))
    }

    let mData
    if ($(".page-numbers.current").next()[0]) {
        mData = {page: (page + 1)}
    } else {
        mData = undefined  // There are no more pages to continue on to, do not provide page metadata
    }

    // This source parses JSON and never requires additional pages
    return createPagedResults({
        results: manga,
        metadata: mData
    })

    // This source parses JSON and never requires additional pages
    return createPagedResults({
        results: manga
    })
}