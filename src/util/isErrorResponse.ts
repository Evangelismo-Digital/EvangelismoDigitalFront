import ErrorResponse from "../interface/ErrorResponse";

function isErrorResponse(error: unknown): error is ErrorResponse {
    if (typeof error !== "object" || error === null) {
        return false;
    }
    const { message, code } = error as Partial<Record<keyof ErrorResponse, unknown>>;
    return typeof message === "string" && typeof code === "string";
}
export default isErrorResponse;
