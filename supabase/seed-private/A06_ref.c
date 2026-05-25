#include <stdio.h>
#include <stdlib.h>

int main()
{
    int* arr;
    int i;

    // 3개의 정수 공간 할당
    arr = (int*)malloc(3 * sizeof(int));

    if (arr == NULL) {
        printf("메모리 할당 실패\n");
        return 1;
    }

    // 값 저장
    for (i = 0; i < 3; i++) {
        arr[i] = (i + 1) * 10;
    }

    printf("기존 배열:\n");
    for (i = 0; i < 3; i++) {
        printf("%d ", arr[i]);
    }

    // 배열 크기를 5개로 확장
    arr = (int*)realloc(arr, 5 * sizeof(int));

    // 재할당 실패 검사
    if (arr == NULL) {
        printf("메모리 재할당 실패\n");
        return 1;
    }

    // 늘어난 새 공간에 40과 50 저장
    arr[3] = 40;
    arr[4] = 50;

    printf("\n\n확장된 배열:\n");
    for (i = 0; i < 5; i++) {
        printf("%d ", arr[i]);
    }

    // 메모리 해제
    free(arr);

    return 0;
}
