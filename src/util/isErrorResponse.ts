import ErrorResponse from "../interface/ErrorResponse";

function isErrorResponse(error: unknown): error is ErrorResponse {
    return typeof error === "object" && error !== null && typeof (error as { requestURI?: unknown }).requestURI === "string";
}
export default isErrorResponse;