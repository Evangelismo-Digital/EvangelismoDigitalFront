/** Error body sent by the backend's HttpErrorMapper. */
interface ErrorResponse {
    message: string;
    code: string;
}
export default ErrorResponse;
