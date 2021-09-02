import {
    MangaStatus
} from 'paperback-extensions-common'

export function allDefined(...fields: any[]): boolean {
    for (let index = 0; index < fields.length; index++) {
        if (fields[index] === undefined) {
            return false
        }
    }
    return true
}

export function verifyOrThrow(message: string, ...fields: any[]) {
    if (!allDefined(fields)) {
        throw new Error(message)
    }
}

export function getStatus(statusText: string | undefined): MangaStatus {
    if (statusText === undefined || statusTexts[statusText] === undefined) {
        throw new Error("Error parsing status!")
    }

    return statusTexts[statusText]
}

const statusTexts: { [key: string]: MangaStatus } = {
    'ON-GOING': MangaStatus.ONGOING,
    'COMPLETED': MangaStatus.COMPLETED
}