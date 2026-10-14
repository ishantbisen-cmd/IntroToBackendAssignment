package com.rajasoftware.leavemanagement.dto;

import com.rajasoftware.leavemanagement.model.LeaveStatus;
import com.rajasoftware.leavemanagement.model.LeaveType;

import java.time.LocalDate;

public record LeaveResponseDto(
        Long id,
        String employeeId,
        LeaveType leaveType,
        LocalDate startDate,
        LocalDate endDate,
        String reason,
        LeaveStatus status
) {
}
