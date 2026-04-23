#include <stdio.h>

void bubbleSortAscending(int arr[], int n) {
    for (int i = 0; i < n - 1; i++) {
        for (int j = 0; j < n - i - 1; j++) {
            if (arr[j] > arr[j + 1]) {
                int tmp = arr[j];
                arr[j] = arr[j + 1];
                arr[j + 1] = tmp;
            }
        }
    }
}

int main(void) {
    int arr[3];
    int n = 3;
    for (int i = 0; i < n; i++) scanf("%d", &arr[i]);

    printf("초기 상태 배열: [ ");
    for (int i = 0; i < n; i++) printf("%d ", arr[i]);
    printf(" ] \n");

    bubbleSortAscending(arr, n);

    printf("정렬된 배열: [ ");
    for (int i = 0; i < n; i++) printf("%d ", arr[i]);
    printf(" ] \n");

    return 0;
}
