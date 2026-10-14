package com.rajasoftware.leavemanagement.exception;

public class LeaveNotFoundException extends RuntimeException {

    public LeaveNotFoundException(Long id) {
        super("Leave request " + id + " was not found.");
    }
}
