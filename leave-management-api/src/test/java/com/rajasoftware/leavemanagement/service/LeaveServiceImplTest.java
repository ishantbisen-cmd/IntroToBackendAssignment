package com.rajasoftware.leavemanagement.service;

import com.rajasoftware.leavemanagement.configuration.LeaveProperties;
import com.rajasoftware.leavemanagement.dto.LeaveRequestDto;
import com.rajasoftware.leavemanagement.dto.LeaveResponseDto;
import com.rajasoftware.leavemanagement.exception.InvalidLeaveRequestException;
import com.rajasoftware.leavemanagement.exception.LeaveNotFoundException;
import com.rajasoftware.leavemanagement.model.LeaveStatus;
import com.rajasoftware.leavemanagement.model.LeaveType;
import com.rajasoftware.leavemanagement.repository.InMemoryLeaveRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LeaveServiceImplTest {

    private LeaveService leaveService;

    @BeforeEach
    void setUp() {
        LeaveProperties properties = new LeaveProperties();
        properties.setMaxDays(10);
        leaveService = new LeaveServiceImpl(new InMemoryLeaveRepository(), properties);
    }

    @Test
    void createAssignsAnIdAndDefaultsTheStatusToPending() {
        LeaveResponseDto created = leaveService.create(request("E1024", "2026-11-02", "2026-11-04", null));

        assertEquals(1L, created.id());
        assertEquals("E1024", created.employeeId());
        assertEquals(LeaveType.SICK, created.leaveType());
        assertEquals(LeaveStatus.PENDING, created.status());
        assertEquals("Fever", created.reason());
    }

    @Test
    void createKeepsAStatusWhenTheCallerSendsOne() {
        LeaveResponseDto created = leaveService.create(request("E1024", "2026-11-02", "2026-11-03", LeaveStatus.APPROVED));

        assertEquals(LeaveStatus.APPROVED, created.status());
    }

    @Test
    void getAllReturnsLeavesInIdOrder() {
        leaveService.create(request("E1", "2026-11-02", "2026-11-02", null));
        leaveService.create(request("E2", "2026-12-01", "2026-12-02", null));

        List<LeaveResponseDto> leaves = leaveService.getAll();

        assertEquals(List.of(1L, 2L), leaves.stream().map(LeaveResponseDto::id).toList());
    }

    @Test
    void getByIdThrowsWhenTheLeaveDoesNotExist() {
        LeaveNotFoundException error = assertThrows(LeaveNotFoundException.class, () -> leaveService.getById(44L));

        assertEquals("Leave request 44 was not found.", error.getMessage());
    }

    @Test
    void updateChangesTheStoredLeaveAndDoesNotClashWithItself() {
        LeaveResponseDto created = leaveService.create(request("E1024", "2026-11-02", "2026-11-03", null));

        LeaveResponseDto updated = leaveService.update(created.id(),
                request("E1024", "2026-11-02", "2026-11-06", LeaveStatus.APPROVED));

        assertEquals(created.id(), updated.id());
        assertEquals(LocalDate.of(2026, 11, 6), updated.endDate());
        assertEquals(LeaveStatus.APPROVED, updated.status());
        assertEquals(LeaveStatus.APPROVED, leaveService.getById(created.id()).status());
    }

    @Test
    void updateThrowsWhenTheLeaveDoesNotExist() {
        assertThrows(LeaveNotFoundException.class,
                () -> leaveService.update(9L, request("E1024", "2026-11-02", "2026-11-03", null)));
    }

    @Test
    void deleteRemovesTheLeave() {
        LeaveResponseDto created = leaveService.create(request("E1024", "2026-11-02", "2026-11-03", null));

        leaveService.delete(created.id());

        assertTrue(leaveService.getAll().isEmpty());
    }

    @Test
    void deleteThrowsWhenTheLeaveDoesNotExist() {
        assertThrows(LeaveNotFoundException.class, () -> leaveService.delete(9L));
    }

    @Test
    void createRejectsALeaveLongerThanTheConfiguredLimit() {
        InvalidLeaveRequestException error = assertThrows(InvalidLeaveRequestException.class,
                () -> leaveService.create(request("E1024", "2026-11-01", "2026-11-11", null)));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatus());
        assertTrue(error.getMessage().contains("10 days"));
    }

    @Test
    void createRejectsAnOverlappingPendingOrApprovedLeave() {
        leaveService.create(request("E1024", "2026-11-02", "2026-11-04", null));

        InvalidLeaveRequestException error = assertThrows(InvalidLeaveRequestException.class,
                () -> leaveService.create(request("E1024", "2026-11-04", "2026-11-05", null)));

        assertEquals(HttpStatus.CONFLICT, error.getStatus());
    }

    @Test
    void aRejectedLeaveDoesNotBlockTheSameDates() {
        leaveService.create(request("E1024", "2026-11-02", "2026-11-04", LeaveStatus.REJECTED));

        LeaveResponseDto created = leaveService.create(request("E1024", "2026-11-02", "2026-11-04", null));

        assertEquals(LeaveStatus.PENDING, created.status());
    }

    @Test
    void touchingRangesDoNotOverlapWhenTheyOnlyMeetAtTheBoundary() {
        leaveService.create(request("E1024", "2026-11-01", "2026-11-03", null));

        LeaveResponseDto next = leaveService.create(request("E1024", "2026-11-04", "2026-11-05", null));

        assertEquals(2L, next.id());
    }

    private LeaveRequestDto request(String employeeId, String start, String end, LeaveStatus status) {
        return new LeaveRequestDto(
                employeeId,
                LeaveType.SICK,
                LocalDate.parse(start),
                LocalDate.parse(end),
                "Fever",
                status
        );
    }
}
