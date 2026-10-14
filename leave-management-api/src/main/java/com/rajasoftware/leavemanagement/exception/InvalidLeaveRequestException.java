package com.rajasoftware.leavemanagement.exception;

import org.springframework.http.HttpStatus;

public class InvalidLeaveRequestException extends RuntimeException {

    private final HttpStatus status;

    public InvalidLeaveRequestException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
