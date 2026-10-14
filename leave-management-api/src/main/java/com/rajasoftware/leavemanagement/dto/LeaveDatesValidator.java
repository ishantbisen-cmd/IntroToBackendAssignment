package com.rajasoftware.leavemanagement.dto;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class LeaveDatesValidator implements ConstraintValidator<ValidLeaveDates, LeaveRequestDto> {

    @Override
    public boolean isValid(LeaveRequestDto value, ConstraintValidatorContext context) {
        if (value == null || value.startDate() == null || value.endDate() == null) {
            return true;
        }
        if (!value.endDate().isBefore(value.startDate())) {
            return true;
        }

        context.disableDefaultConstraintViolation();
        context.buildConstraintViolationWithTemplate("endDate must be on or after startDate")
                .addPropertyNode("endDate")
                .addConstraintViolation();
        return false;
    }
}
