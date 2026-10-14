package com.rajasoftware.leavemanagement.dto;

import com.rajasoftware.leavemanagement.model.LeaveStatus;
import com.rajasoftware.leavemanagement.model.LeaveType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

@ValidLeaveDates
public record LeaveRequestDto(
        @NotBlank(message = "employeeId is required")
        @Size(max = 20, message = "employeeId must be 20 characters or fewer")
        String employeeId,

        @NotNull(message = "leaveType is required")
        LeaveType leaveType,

        @NotNull(message = "startDate is required")
        LocalDate startDate,

        @NotNull(message = "endDate is required")
        LocalDate endDate,

        @NotBlank(message = "reason is required")
        @Size(max = 250, message = "reason must be 250 characters or fewer")
        String reason,

        LeaveStatus status
) {
}
